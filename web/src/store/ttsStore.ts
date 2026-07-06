import { create } from 'zustand';
import { TtsEngine, WebSpeechProvider, extractUnits, type TtsStatus } from '../lib/tts';

// Estado reactivo del modo lector. La lógica imperativa (síntesis, cola, avance)
// vive en TtsEngine; acá sólo exponemos estado + acciones para la UI.
// Motor singleton a nivel módulo (una sola instancia por ventana).

const engine = new TtsEngine(new WebSpeechProvider());

interface TtsState {
  available: boolean;
  status: TtsStatus;
  index: number;
  total: number;
  /** Play/pausa/reanudar según el estado actual. */
  toggle: () => void;
  /** Detiene y resetea la lectura. */
  stop: () => void;
  /** Salta a la oración siguiente. */
  next: () => void;
  /** Salta a la oración anterior. */
  prev: () => void;
}

export const useTts = create<TtsState>((set, get) => {
  engine.onChange = ({ status, index, total }) => set({ status, index, total });

  // Arranca desde el documento renderizado. Hay una sola `.markdown-body` en el
  // árbol, así que la buscamos directo (evita cablear refs por props).
  const startFromDom = async () => {
    const root = document.querySelector('.markdown-body');
    const units = extractUnits(root, 'es');
    if (!units.length) return;
    // Heurística temporal: preferimos una voz en español si existe. La selección
    // de voz/idioma real (por documento, persistida) es de la Fase 4.
    try {
      const voices = await engine.getVoices();
      const es = voices.find((v) => v.lang.toLowerCase().startsWith('es'));
      engine.setOptions({ rate: 1, voiceId: es?.id, lang: es?.lang || 'es-ES' });
    } catch {
      engine.setOptions({ rate: 1, lang: 'es-ES' });
    }
    engine.load(units);
    engine.play();
  };

  return {
    available: engine.isAvailable(),
    status: 'idle',
    index: 0,
    total: 0,
    toggle: () => {
      const { status } = get();
      if (status === 'playing') return engine.pause();
      if (status === 'paused') return engine.play();
      void startFromDom(); // idle → cargar doc y arrancar
    },
    stop: () => engine.stop(),
    next: () => engine.next(),
    prev: () => engine.prev(),
  };
});
