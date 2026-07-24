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
import { PiperProvider } from '../lib/piper';

// Estado reactivo del modo lector. La lógica imperativa (síntesis, cola, avance)
// vive en TtsEngine; acá exponemos estado + acciones para la UI y persistimos las
// preferencias (voz, velocidad, calidad) en un key propio, aparte de los estilos.
// Motor singleton a nivel módulo con dos providers intercambiables:
//   - system (WebSpeech/SAPI): default, arranque instantáneo.
//   - neural (Piper): "alta calidad", carga perezosa, con system de fallback.

const webProvider = new WebSpeechProvider();
const piperProvider = new PiperProvider();
const engine = new TtsEngine(webProvider);
const TTS_KEY = 'md-reader-tts';

/** Calidad de voz: 'system' = voces del SO (SAPI); 'neural' = Piper. */
export type TtsQuality = 'system' | 'neural';
/** Estado de carga del motor neuronal (Piper) para dar feedback en la UI. */
export type PiperStatus = 'idle' | 'loading' | 'ready' | 'error';

interface TtsPrefs {
  voiceId: string | null; // null = automática (según idioma del documento)
  rate: number;
  quality: TtsQuality;
}

function loadPrefs(): TtsPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(TTS_KEY) || '{}');
    return {
      voiceId: typeof p.voiceId === 'string' ? p.voiceId : null,
      rate: typeof p.rate === 'number' ? p.rate : 1,
      quality: p.quality === 'neural' ? 'neural' : 'system',
    };
  } catch {
    return { voiceId: null, rate: 1, quality: 'system' };
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
  /** Velocidad de lectura. Persistida. Sólo aplica a las voces del SO. */
  rate: number;
  /** Calidad de voz activa (system/neural). Persistida. */
  quality: TtsQuality;
  /** Piper disponible en este entorno (WASM + OPFS + Audio). */
  piperAvailable: boolean;
  /** Estado de carga de Piper (para spinner / mensaje de error). */
  piperStatus: PiperStatus;
  /** Mensaje del último fallo de Piper, si cayó a system. */
  piperError: string | null;
  /** Play/pausa/reanudar según el estado actual. */
  toggle: () => void;
  /** Detiene y resetea la lectura. */
  stop: () => void;
  /** Salta a la oración siguiente. */
  next: () => void;
  /** Salta a la oración anterior. */
  prev: () => void;
  /** Fija la voz del SO (o null = automática). Se aplica en vivo y se persiste. */
  setVoice: (id: string | null) => void;
  /** Fija la velocidad (voces del SO). Se aplica en vivo y se persiste. */
  setRate: (rate: number) => void;
  /** Cambia la calidad (system/neural). Warm-up de Piper con fallback a system. */
  setQuality: (q: TtsQuality) => void;
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

  const piperAvailable = piperProvider.isAvailable();
  // Honramos la preferencia neural: enrutamos el motor a Piper, pero NO lo
  // cargamos en el arranque (60 MB + WASM). La carga es perezosa: ocurre en el
  // primer play (ensureBackend), con spinner y fallback.
  if (prefs.quality === 'neural' && piperAvailable) engine.setProvider(piperProvider);

  const currentPrefs = (): TtsPrefs => ({
    voiceId: get().voiceId,
    rate: get().rate,
    quality: get().quality,
  });

  // Garantiza el backend correcto antes de reproducir. En 'neural' hace el warm-up
  // de Piper (siembra OPFS + carga el modelo) mostrando estado 'loading'; si falla,
  // cae a las voces del SO y lo recuerda. Devuelve cuando se puede reproducir.
  const ensureBackend = async (): Promise<void> => {
    if (get().quality !== 'neural' || !get().piperAvailable) return;
    if (get().piperStatus === 'ready') return;
    set({ piperStatus: 'loading', piperError: null });
    try {
      await piperProvider.prepare();
      engine.setProvider(piperProvider);
      set({ piperStatus: 'ready' });
    } catch (e) {
      engine.setProvider(webProvider);
      const quality: TtsQuality = 'system';
      persistPrefs({ ...currentPrefs(), quality });
      set({
        quality,
        piperStatus: 'error',
        piperError: e instanceof Error ? e.message : String(e),
      });
    }
  };

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

  const startFromDom = async () => {
    if (!buildAndLoad()) return;
    await ensureBackend();
    engine.play();
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
    quality: prefs.quality === 'neural' && piperAvailable ? 'neural' : 'system',
    piperAvailable,
    piperStatus: 'idle',
    piperError: null,
    toggle: () => {
      const { status } = get();
      if (status === 'playing') return engine.pause();
      if (status === 'paused') return engine.play();
      void startFromDom(); // idle → cargar doc, asegurar backend y arrancar
    },
    stop: () => {
      engine.stop();
      set({ units: [] });
    },
    next: () => engine.next(),
    prev: () => engine.prev(),
    setVoice: (id) => {
      persistPrefs({ ...currentPrefs(), voiceId: id });
      set({ voiceId: id });
      engine.setOptions({ voiceId: id ?? undefined });
    },
    setRate: (rate) => {
      persistPrefs({ ...currentPrefs(), rate });
      set({ rate });
      engine.setOptions({ rate });
    },
    setQuality: (q) => {
      if (q === get().quality) return;
      if (q === 'neural' && !get().piperAvailable) return;
      persistPrefs({ ...currentPrefs(), quality: q });
      set({ quality: q });
      if (q === 'system') {
        engine.setProvider(webProvider);
        set({ piperStatus: 'idle', piperError: null });
        return;
      }
      // Warm-up inmediato al activar 'neural': feedback + detección de fallo. Si
      // hay lectura en curso, engine.setProvider (dentro de ensureBackend) la
      // continúa desde la oración actual con la voz neuronal.
      void ensureBackend();
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
      void (async () => {
        await ensureBackend();
        engine.seekTo(idx);
        engine.play();
      })();
    },
  };
});
