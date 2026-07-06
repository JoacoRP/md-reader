// Motor de texto-a-voz (TTS) del "modo lector".
//
// Diseñado alrededor de una interfaz `TtsProvider` para poder cambiar el backend
// de síntesis sin tocar la UI ni el store:
//   - v1 (este archivo): WebSpeechProvider — voces del SO vía Web Speech API.
//   - v2 (futuro): PiperProvider — TTS neuronal local, con WebSpeech de fallback.
//
// El `TtsEngine` maneja la cola de unidades (oraciones), el avance automático y
// los callbacks de estado; el provider sólo sabe "decir este texto".

export type TtsStatus = 'idle' | 'playing' | 'paused';

// Unidad mínima de lectura. En Fase 1 sólo lleva texto; en Fase 3 sumará la
// referencia al nodo del DOM para resaltar/scrollear.
export interface TtsUnit {
  text: string;
}

export interface TtsVoice {
  id: string; // voiceURI
  name: string;
  lang: string;
}

export interface SpeakOptions {
  voiceId?: string;
  rate?: number;
  lang?: string;
}

export interface SpeakHandlers {
  onStart?: () => void;
  onEnd: () => void;
  onError: () => void;
}

export interface TtsProvider {
  readonly id: string;
  isAvailable(): boolean;
  getVoices(): Promise<TtsVoice[]>;
  speak(text: string, opts: SpeakOptions, handlers: SpeakHandlers): void;
  pause(): void;
  resume(): void;
  cancel(): void;
}

// --- Provider v1: Web Speech API (voces SAPI del SO) -----------------------

function mapVoices(list: SpeechSynthesisVoice[]): TtsVoice[] {
  return list.map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
}

export class WebSpeechProvider implements TtsProvider {
  readonly id = 'web-speech';

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  // Chromium carga las voces de forma asíncrona: si aún no están, esperamos el
  // evento `voiceschanged` (con timeout para no colgar la promesa).
  getVoices(): Promise<TtsVoice[]> {
    return new Promise((resolve) => {
      if (!this.isAvailable()) return resolve([]);
      const synth = window.speechSynthesis;
      const ready = synth.getVoices();
      if (ready.length) return resolve(mapVoices(ready));
      const onChange = () => {
        const list = synth.getVoices();
        if (list.length) {
          synth.removeEventListener('voiceschanged', onChange);
          resolve(mapVoices(list));
        }
      };
      synth.addEventListener('voiceschanged', onChange);
      setTimeout(() => {
        synth.removeEventListener('voiceschanged', onChange);
        resolve(mapVoices(synth.getVoices()));
      }, 1500);
    });
  }

  speak(text: string, opts: SpeakOptions, handlers: SpeakHandlers): void {
    if (!this.isAvailable()) return handlers.onError();
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    if (opts.rate) u.rate = opts.rate;

    const voices = synth.getVoices();
    let voice = opts.voiceId ? voices.find((v) => v.voiceURI === opts.voiceId) : undefined;
    if (!voice && opts.lang) {
      const two = opts.lang.slice(0, 2).toLowerCase();
      voice = voices.find((v) => v.lang === opts.lang) || voices.find((v) => v.lang.toLowerCase().startsWith(two));
    }
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else if (opts.lang) {
      u.lang = opts.lang;
    }

    u.onstart = () => handlers.onStart?.();
    u.onend = () => handlers.onEnd();
    u.onerror = (e) => {
      // `interrupted`/`canceled` son consecuencia de cancel(): no son errores reales.
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      handlers.onError();
    };
    synth.speak(u);
  }

  pause(): void {
    if (this.isAvailable()) window.speechSynthesis.pause();
  }
  resume(): void {
    if (this.isAvailable()) window.speechSynthesis.resume();
  }
  cancel(): void {
    if (this.isAvailable()) window.speechSynthesis.cancel();
  }
}

// --- Motor: cola de unidades + avance + estado -----------------------------

export interface EngineState {
  status: TtsStatus;
  index: number;
  total: number;
}

export class TtsEngine {
  private provider: TtsProvider;
  private units: TtsUnit[] = [];
  private index = 0;
  private status: TtsStatus = 'idle';
  private opts: SpeakOptions = { rate: 1 };
  // Token de la utterance vigente: los callbacks de una cancelada llegan con un
  // token viejo y se ignoran (evita avances dobles al saltar/detener).
  private speakToken = 0;
  // true cuando se saltó estando en pausa: al reanudar hay que rehablar la unidad
  // destino (no se puede "resumir" una utterance ya cancelada).
  private replayOnResume = false;
  onChange: (s: EngineState) => void = () => {};

  constructor(provider: TtsProvider) {
    this.provider = provider;
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }
  getVoices(): Promise<TtsVoice[]> {
    return this.provider.getVoices();
  }
  setOptions(o: Partial<SpeakOptions>): void {
    this.opts = { ...this.opts, ...o };
  }

  load(units: TtsUnit[]): void {
    this.cancelSpeech();
    this.units = units;
    this.index = 0;
    this.status = 'idle';
    this.replayOnResume = false;
    this.emit();
  }

  play(): void {
    if (!this.units.length || this.status === 'playing') return;
    if (this.status === 'paused' && !this.replayOnResume) {
      this.status = 'playing';
      this.provider.resume();
      this.emit();
      return;
    }
    // idle, o reanudar tras un salto en pausa → hablar la unidad actual de cero
    this.replayOnResume = false;
    this.index = Math.min(Math.max(this.index, 0), this.units.length - 1);
    this.status = 'playing';
    this.emit();
    this.speakCurrent();
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.replayOnResume = false;
    this.provider.pause();
    this.emit();
  }

  stop(): void {
    if (this.status === 'idle' && this.index === 0) return;
    this.status = 'idle';
    this.index = 0;
    this.replayOnResume = false;
    this.cancelSpeech();
    this.emit();
  }

  next(): void {
    this.seekTo(this.index + 1);
  }

  prev(): void {
    this.seekTo(this.index - 1);
  }

  seekTo(target: number): void {
    if (!this.units.length) return;
    this.index = Math.min(Math.max(target, 0), this.units.length - 1);
    if (this.status === 'playing') {
      this.cancelSpeech();
      this.emit();
      this.speakCurrent();
    } else if (this.status === 'paused') {
      this.cancelSpeech();
      this.replayOnResume = true; // la próxima reanudación rehabla la unidad destino
      this.emit();
    } else {
      this.emit(); // idle: sólo movemos el cursor
    }
  }

  private speakCurrent(): void {
    const unit = this.units[this.index];
    if (!unit) return this.finish();
    const token = ++this.speakToken;
    this.emit();
    this.provider.speak(unit.text, this.opts, {
      onEnd: () => {
        if (token === this.speakToken) this.advance();
      },
      onError: () => {
        if (token === this.speakToken) this.advance();
      },
    });
  }

  private advance(): void {
    if (this.status !== 'playing') return; // pausado o detenido: no avanzar
    if (this.index + 1 >= this.units.length) return this.finish();
    this.index += 1;
    this.speakCurrent();
  }

  private finish(): void {
    this.status = 'idle';
    this.index = 0;
    this.replayOnResume = false;
    this.cancelSpeech();
    this.emit();
  }

  // Invalida la utterance en curso: sube el token (para descartar su onEnd/onError
  // tardío) y cancela en el provider.
  private cancelSpeech(): void {
    this.speakToken += 1;
    this.provider.cancel();
  }

  private emit(): void {
    this.onChange({ status: this.status, index: this.index, total: this.units.length });
  }
}

// --- Extracción de texto legible desde el DOM del Markdown ------------------
// Recorre `.markdown-body` en orden, saltea código/diagramas/anclas, arma un
// texto por bloque y lo parte en oraciones (Fase 3 refinará el mapeo a nodos).

const SKIP_TAGS = new Set(['PRE', 'SCRIPT', 'STYLE', 'BUTTON', 'CODE']);
const LEAF_BLOCKS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'DT', 'DD', 'CAPTION', 'FIGCAPTION', 'BLOCKQUOTE',
]);
// Si un bloque contiene alguno de estos, no es "hoja": hay que recursar.
const NESTED_BLOCK_SEL = 'p,ul,ol,table,blockquote,pre,h1,h2,h3,h4,h5,h6,li,dl';

function isSkippable(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  return (
    el.classList.contains('mermaid-block') ||
    el.classList.contains('copy-code') ||
    el.classList.contains('heading-anchor')
  );
}

// Texto de un bloque hoja, sin el "#" del ancla ni bloques de código.
function cleanText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('.heading-anchor, .copy-code, pre, .mermaid-block').forEach((n) => n.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

// Texto propio de un contenedor (p. ej. "Item" antes de una sublista anidada).
function directText(el: Element): string {
  let s = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) s += n.textContent;
  });
  return s.replace(/\s+/g, ' ').trim();
}

function collectBlocks(el: Element, out: string[]): void {
  for (const child of Array.from(el.children)) {
    if (isSkippable(child)) continue;
    const isLeaf = LEAF_BLOCKS.has(child.tagName) && !child.querySelector(NESTED_BLOCK_SEL);
    if (isLeaf) {
      const t = cleanText(child);
      if (t) out.push(t);
    } else {
      const own = directText(child);
      if (own) out.push(own);
      collectBlocks(child, out);
    }
  }
}

function splitSentences(text: string, lang?: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    try {
      const seg = new Seg(lang, { granularity: 'sentence' });
      const out: string[] = [];
      for (const part of seg.segment(text)) {
        const t = part.segment.trim();
        if (t) out.push(t);
      }
      return out.length ? out : [text];
    } catch {
      /* sin soporte de Segmenter: caemos al regex de abajo */
    }
  }
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Parte oraciones muy largas para esquivar el corte de utterances de Chromium (~15s).
function capLength(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(',', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function extractUnits(root: Element | null, lang?: string): TtsUnit[] {
  if (!root) return [];
  const blocks: string[] = [];
  collectBlocks(root, blocks);
  const units: TtsUnit[] = [];
  for (const block of blocks) {
    for (const sentence of splitSentences(block, lang)) {
      for (const chunk of capLength(sentence, 220)) {
        units.push({ text: chunk });
      }
    }
  }
  return units;
}
