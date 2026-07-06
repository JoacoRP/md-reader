import { create } from 'zustand';
import {
  TtsEngine,
  WebSpeechProvider,
  extractUnits,
  detectLang,
  unitIndexAtPoint,
  type TtsStatus,
  type TtsUnit,
  type TtsVoice,
} from '../lib/tts';

// Estado reactivo del modo lector. La lógica imperativa (síntesis, cola, avance)
// vive en TtsEngine; acá exponemos estado + acciones para la UI y persistimos las
// preferencias (voz elegida + velocidad) en un key propio, aparte de los estilos.
// Motor singleton a nivel módulo (una sola instancia por ventana).

const engine = new TtsEngine(new WebSpeechProvider());
const TTS_KEY = 'md-reader-tts';

interface TtsPrefs {
  voiceId: string | null; // null = automática (según idioma del documento)
  rate: number;
}

function loadPrefs(): TtsPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(TTS_KEY) || '{}');
    return {
      voiceId: typeof p.voiceId === 'string' ? p.voiceId : null,
      rate: typeof p.rate === 'number' ? p.rate : 1,
    };
  } catch {
    return { voiceId: null, rate: 1 };
  }
}

function persistPrefs(p: TtsPrefs): void {
  try {
    localStorage.setItem(TTS_KEY, JSON.stringify(p));
  } catch {
    /* almacenamiento no disponible: best-effort */
  }
}

interface TtsState {
  available: boolean;
  status: TtsStatus;
  index: number;
  total: number;
  /** Unidades del documento en curso (con su Range) para resaltar la actual. */
  units: TtsUnit[];
  /** Voces disponibles en el SO (se cargan async en Chromium). */
  voices: TtsVoice[];
  /** Voz elegida por el usuario, o null = automática por idioma. Persistida. */
  voiceId: string | null;
  /** Velocidad de lectura. Persistida. */
  rate: number;
  /** Play/pausa/reanudar según el estado actual. */
  toggle: () => void;
  /** Detiene y resetea la lectura. */
  stop: () => void;
  /** Salta a la oración siguiente. */
  next: () => void;
  /** Salta a la oración anterior. */
  prev: () => void;
  /** Fija la voz (o null = automática). Se aplica en vivo y se persiste. */
  setVoice: (id: string | null) => void;
  /** Fija la velocidad. Se aplica en vivo y se persiste. */
  setRate: (rate: number) => void;
  /** Empieza (o salta) la lectura desde la oración bajo el punto de pantalla. */
  readFrom: (x: number, y: number) => void;
}

export const useTts = create<TtsState>((set, get) => {
  engine.onChange = ({ status, index, total }) => set({ status, index, total });

  const prefs = loadPrefs();
  engine.setOptions({ rate: prefs.rate, voiceId: prefs.voiceId ?? undefined });
  // Cargamos las voces del SO (en Chromium llegan async vía 'voiceschanged').
  engine
    .getVoices()
    .then((voices) => set({ voices }))
    .catch(() => {});

  // Extrae las unidades del documento renderizado y las carga en el motor. Hay
  // una sola `.markdown-body` en el árbol, así que la buscamos directo (evita
  // cablear refs por props). Devuelve las unidades, o null si no hay nada que leer.
  const buildAndLoad = (): TtsUnit[] | null => {
    const root = document.querySelector('.markdown-body');
    if (!root) return null;
    const lang = detectLang(root.textContent || '');
    const units = extractUnits(root, lang);
    if (!units.length) return null;
    const { voiceId, rate } = get();
    // voiceId explícito manda; si es null, el provider elige por `lang`.
    engine.setOptions({ rate, voiceId: voiceId ?? undefined, lang });
    engine.load(units);
    set({ units });
    return units;
  };

  const startFromDom = () => {
    if (buildAndLoad()) engine.play();
  };

  return {
    available: engine.isAvailable(),
    status: 'idle',
    index: 0,
    total: 0,
    units: [],
    voices: [],
    voiceId: prefs.voiceId,
    rate: prefs.rate,
    toggle: () => {
      const { status } = get();
      if (status === 'playing') return engine.pause();
      if (status === 'paused') return engine.play();
      startFromDom(); // idle → cargar doc y arrancar
    },
    stop: () => {
      engine.stop();
      set({ units: [] });
    },
    next: () => engine.next(),
    prev: () => engine.prev(),
    setVoice: (id) => {
      persistPrefs({ voiceId: id, rate: get().rate });
      set({ voiceId: id });
      engine.setOptions({ voiceId: id ?? undefined });
    },
    setRate: (rate) => {
      persistPrefs({ voiceId: get().voiceId, rate });
      set({ rate });
      engine.setOptions({ rate });
    },
    readFrom: (x, y) => {
      let units = get().units;
      // En reposo (o sin unidades cargadas) construimos desde el DOM actual.
      if (get().status === 'idle' || !units.length) {
        const built = buildAndLoad();
        if (!built) return;
        units = built;
      }
      const idx = unitIndexAtPoint(units, x, y);
      if (idx < 0) return;
      engine.seekTo(idx);
      engine.play();
    },
  };
});
