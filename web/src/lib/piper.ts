// Provider v2 del modo lector: TTS neuronal local con Piper (VITS/ONNX), la
// opción "alta calidad" frente a las voces SAPI del SO (WebSpeechProvider).
//
// A diferencia de Web Speech (que habla directo), Piper SINTETIZA un buffer de
// audio y después lo reproduce: speak() = sintetizar (async, en WASM) → reproducir
// con un <audio>. pause/resume/cancel se mapean a ese elemento de audio.
//
// Todo corre offline: el motor WASM (onnxruntime + phonemizer espeak) y el modelo
// de voz se empaquetan en web/public/piper/ (ver scripts/fetch-piper-assets.mjs).
// La librería @mintplex-labs/piper-tts-web hardcodea la URL del modelo a
// HuggingFace, pero cachea en OPFS por nombre de archivo; pre-sembramos OPFS desde
// nuestros archivos locales para que nunca toque la red.

import { TtsSession } from '@mintplex-labs/piper-tts-web';
import type { SpeakHandlers, SpeakOptions, TtsProvider, TtsVoice } from './tts';

// Voz bundleada. El id debe existir en el PATH_MAP de la librería y coincidir con
// el que baja scripts/fetch-piper-assets.mjs.
const PIPER_VOICE_ID = 'es_ES-davefx-medium';

export const PIPER_VOICE: TtsVoice = {
  id: PIPER_VOICE_ID,
  name: 'Piper — Castellano (neuronal)',
  lang: 'es-ES',
};

// Rutas locales que sirve nuestro server (o Vite en dev) desde web/public/piper/.
const WASM_PATHS = {
  onnxWasm: '/piper/ort/', // prefijo de directorio: ort le agrega el nombre del .wasm
  piperWasm: '/piper/phonemize/piper_phonemize.wasm',
  piperData: '/piper/phonemize/piper_phonemize.data',
};

// Archivos del modelo (nombres = último segmento de la URL de HuggingFace, para
// que el readBlob de la librería los encuentre en OPFS).
const MODEL_FILES = [`${PIPER_VOICE_ID}.onnx`, `${PIPER_VOICE_ID}.onnx.json`];

// Copia los archivos del modelo a OPFS (carpeta 'piper', igual que la librería) si
// no están ya. Los lee de /piper/models/ (bundle local) — cero red.
async function seedOpfs(): Promise<void> {
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (!storage?.getDirectory) throw new Error('OPFS no disponible en este entorno');
  const root = await storage.getDirectory();
  const dir = await root.getDirectoryHandle('piper', { create: true });

  for (const file of MODEL_FILES) {
    if (await opfsHas(dir, file)) continue;
    const res = await fetch(`/piper/models/${file}`);
    if (!res.ok) throw new Error(`No pude cargar ${file} (HTTP ${res.status})`);
    const blob = await res.blob();
    const handle = await dir.getFileHandle(file, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }
}

async function opfsHas(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return file.size > 0;
  } catch {
    return false;
  }
}

export class PiperProvider implements TtsProvider {
  readonly id = 'piper';
  private session: TtsSession | null = null;
  private ready: Promise<void> | null = null;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  // La síntesis es async: estas banderas dejan que pause/cancel lleguen "antes"
  // de que el audio arranque y aún así se respeten.
  private cancelled = false;
  private paused = false;

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof WebAssembly !== 'undefined' &&
      typeof Audio !== 'undefined' &&
      !!(navigator.storage as { getDirectory?: unknown } | undefined)?.getDirectory
    );
  }

  getVoices(): Promise<TtsVoice[]> {
    return Promise.resolve([PIPER_VOICE]);
  }

  // Warmup perezoso y memoizado: siembra OPFS + carga el modelo ONNX una sola vez.
  // El store lo llama al activar "alta calidad" para mostrar spinner y, si falla,
  // caer a las voces del SO. Un fallo resetea la promesa para permitir reintento.
  prepare(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await seedOpfs();
        this.session = await TtsSession.create({
          voiceId: PIPER_VOICE_ID,
          wasmPaths: WASM_PATHS,
        });
      })().catch((e) => {
        this.ready = null;
        throw e;
      });
    }
    return this.ready;
  }

  speak(text: string, _opts: SpeakOptions, handlers: SpeakHandlers): void {
    // Nota: Piper no soporta velocidad variable vía esta API (usa el length_scale
    // fijo del modelo); `_opts.rate` se ignora a propósito.
    this.cancelled = false;
    this.paused = false;
    void this.synthesizeAndPlay(text, handlers);
  }

  private async synthesizeAndPlay(text: string, handlers: SpeakHandlers): Promise<void> {
    try {
      await this.prepare();
      if (this.cancelled) return;
      const blob = await this.session!.predict(text);
      if (this.cancelled) return;

      this.teardownAudio();
      const url = URL.createObjectURL(blob);
      this.objectUrl = url;
      const audio = new Audio(url);
      this.audio = audio;
      audio.onended = () => {
        this.teardownAudio();
        if (!this.cancelled) handlers.onEnd();
      };
      audio.onerror = () => {
        this.teardownAudio();
        if (!this.cancelled) handlers.onError();
      };

      handlers.onStart?.();
      if (!this.paused) this.startPlayback(handlers);
      // Si está en pausa, resume() disparará la reproducción.
    } catch {
      if (!this.cancelled) handlers.onError();
    }
  }

  private startPlayback(handlers: SpeakHandlers): void {
    this.audio?.play().catch((err: unknown) => {
      // AbortError = pausa/cancel justo en el arranque: no es un error real.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!this.cancelled) {
        this.teardownAudio();
        handlers.onError();
      }
    });
  }

  pause(): void {
    this.paused = true;
    this.audio?.pause();
  }

  resume(): void {
    this.paused = false;
    this.audio?.play().catch(() => {});
  }

  cancel(): void {
    this.cancelled = true;
    this.paused = false;
    this.teardownAudio();
  }

  private teardownAudio(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      try {
        this.audio.pause();
      } catch {
        /* best-effort */
      }
      this.audio.src = '';
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
