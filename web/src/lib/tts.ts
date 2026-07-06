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

// Unidad mínima de lectura: una oración (o sub-tramo). `range` apunta al texto
// en el DOM para resaltarlo/scrollearlo (Fase 3); es opcional porque el motor
// sólo necesita `text` y el resaltado degrada elegante si no hay soporte.
export interface TtsUnit {
  text: string;
  range?: Range;
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
// Recorre `.markdown-body` en orden de documento, agrupa los nodos de texto por
// su bloque contenedor (párrafo, ítem, encabezado, celda…), saltea código en
// bloque/diagramas/anclas, y parte cada bloque en oraciones. Cada unidad guarda
// un `Range` del DOM para resaltar/scrollear sin mutar el HTML renderizado.

const BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'DT', 'DD', 'CAPTION', 'FIGCAPTION', 'BLOCKQUOTE',
]);

// Un ancestro que hace ignorar el texto que contiene: código en bloque (pre),
// diagrama Mermaid, botón "Copiar" o el ancla "#" del heading.
function isSkippableAncestor(el: Element): boolean {
  const tag = el.tagName;
  if (tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'BUTTON') return true;
  return (
    el.classList.contains('mermaid-block') ||
    el.classList.contains('copy-code') ||
    el.classList.contains('heading-anchor')
  );
}

function textRejected(node: Node, root: Element): boolean {
  let p = node.parentElement;
  while (p && p !== root.parentElement) {
    if (isSkippableAncestor(p)) return true;
    p = p.parentElement;
  }
  return false;
}

// Bloque contenedor más cercano de un nodo de texto (para no mezclar oraciones
// entre párrafos). Si no hay uno conocido, cae al padre directo.
function nearestBlock(node: Node, root: Element): Element {
  let p = node.parentElement;
  while (p && p !== root.parentElement) {
    if (BLOCK_TAGS.has(p.tagName)) return p;
    p = p.parentElement;
  }
  return node.parentElement || root;
}

interface TextPiece {
  node: Text;
  start: number; // offset acumulado dentro del texto del bloque
}

// Construye un Range del DOM para el tramo [from, to) del texto del bloque,
// mapeando cada offset al nodo de texto correspondiente.
function makeRange(pieces: TextPiece[], from: number, to: number): Range | undefined {
  if (!pieces.length) return undefined;
  const locate = (o: number): [Text, number] => {
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const end = piece.start + piece.node.length;
      if (o < end || i === pieces.length - 1) {
        return [piece.node, Math.max(0, Math.min(o - piece.start, piece.node.length))];
      }
    }
    const last = pieces[pieces.length - 1];
    return [last.node, last.node.length];
  };
  try {
    const [sn, so] = locate(from);
    const [en, eo] = locate(to);
    const range = document.createRange();
    range.setStart(sn, so);
    range.setEnd(en, eo);
    return range;
  } catch {
    return undefined;
  }
}

// Rangos [start, end) de cada oración dentro de `text`.
function splitSentences(text: string, lang?: string): Array<[number, number]> {
  const Seg = (Intl as unknown as {
    Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ index: number; segment: string }> };
  }).Segmenter;
  const out: Array<[number, number]> = [];
  if (Seg) {
    try {
      const seg = new Seg(lang, { granularity: 'sentence' });
      for (const part of seg.segment(text)) out.push([part.index, part.index + part.segment.length]);
      return out;
    } catch {
      /* sin soporte de Segmenter: caemos al regex de abajo */
    }
  }
  const re = /[^.!?…]*[.!?…]+|\S[^.!?…]*$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
  return out.length ? out : [[0, text.length]];
}

// Parte un tramo largo [s, e) en sub-tramos <= max, cortando en coma/espacio,
// para esquivar el corte de utterances de Chromium (~15s).
function capOffsets(text: string, s: number, e: number, max: number): Array<[number, number]> {
  if (e - s <= max) return [[s, e]];
  const parts: Array<[number, number]> = [];
  let start = s;
  while (e - start > max) {
    let cut = text.lastIndexOf(',', start + max);
    if (cut <= start) cut = text.lastIndexOf(' ', start + max);
    if (cut <= start) cut = start + max;
    parts.push([start, cut]);
    start = cut;
    while (start < e && /\s/.test(text[start])) start++;
  }
  if (e - start > 0) parts.push([start, e]);
  return parts;
}

function trimOffsets(text: string, s: number, e: number): [number, number] {
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return [s, e];
}

export function extractUnits(root: Element | null, lang?: string): TtsUnit[] {
  if (!root) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (textRejected(n, root) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });

  const units: TtsUnit[] = [];
  let block: Element | null = null;
  let pieces: TextPiece[] = [];
  let full = '';

  const flush = () => {
    if (full.trim()) {
      for (const [ss, se] of splitSentences(full, lang)) {
        for (const [cs, ce] of capOffsets(full, ss, se, 220)) {
          const [ts, te] = trimOffsets(full, cs, ce);
          const chunk = full.slice(ts, te);
          if (chunk) units.push({ text: chunk, range: makeRange(pieces, ts, te) });
        }
      }
    }
    pieces = [];
    full = '';
  };

  let node = walker.nextNode() as Text | null;
  while (node) {
    const b = nearestBlock(node, root);
    if (b !== block && pieces.length) flush();
    block = b;
    pieces.push({ node, start: full.length });
    full += node.data;
    node = walker.nextNode() as Text | null;
  }
  if (pieces.length) flush();
  return units;
}

// --- Resaltado + auto-scroll de la oración en curso (CSS Custom Highlight) ---

const HIGHLIGHT_NAME = 'tts-active';

interface HighlightRegistry {
  set(name: string, hl: unknown): void;
  delete(name: string): void;
}

function highlightRegistry(): HighlightRegistry | null {
  const reg = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  return reg || null;
}

// Resalta el `range` dado (o limpia si es undefined). No-op si el navegador no
// soporta la CSS Custom Highlight API: la lectura sigue funcionando igual.
export function setTtsHighlight(range: Range | undefined): void {
  const reg = highlightRegistry();
  if (!reg) return;
  const Ctor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!range || !Ctor) {
    reg.delete(HIGHLIGHT_NAME);
    return;
  }
  reg.set(HIGHLIGHT_NAME, new Ctor(range));
}

// Scrollea el contenedor lo mínimo para que la oración quede en una banda cómoda.
export function scrollRangeIntoView(range: Range, container: HTMLElement): void {
  const r = range.getBoundingClientRect();
  if (!r.height && !r.width) return;
  const c = container.getBoundingClientRect();
  const topBand = c.top + c.height * 0.15;
  const botBand = c.top + c.height * 0.78;
  if (r.top >= topBand && r.bottom <= botBand) return; // ya está cómodo en pantalla
  container.scrollBy({ top: r.top - (c.top + c.height * 0.32), behavior: 'smooth' });
}
