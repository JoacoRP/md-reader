import { create } from 'zustand';

// Modelo de configuración (espejo de public/config.js). El shape en localStorage
// se mantiene byte-compatible con la versión vanilla para no perder los ajustes
// existentes: el objeto crudo de Settings vive bajo STORAGE_KEY, y la lista de
// presets custom bajo PRESETS_KEY. Por eso NO usamos el wrapper de persist.

export const VERSION = '2.1.0';
const STORAGE_KEY = 'md-reader-settings';
const PRESETS_KEY = 'md-reader-presets';

export type LinkUnderline = 'none' | 'hover' | 'always';
export type CodeTheme = 'auto' | 'light' | 'dark';
export type MermaidTheme = 'auto' | 'default' | 'neutral' | 'forest' | 'dark';
export type ThemeMode = 'light' | 'dark';
export type FontFamilyKey = 'system' | 'serif' | 'inter' | 'georgia' | 'mono';

export interface Settings {
  fontFamily: FontFamilyKey | string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  contentWidth: number;
  paragraphSpacing: number;
  justify: boolean;
  textColor: string;
  bgColor: string;
  accentColor: string;
  headingColor: string;
  linkColor: string;
  linkUnderline: LinkUnderline;
  codeFontSize: number;
  codeTheme: CodeTheme;
  mermaidTheme: MermaidTheme;
  theme: ThemeMode;
}

export interface CustomPreset {
  name: string;
  settings: Settings;
}

export const FONT_FAMILIES: Record<FontFamilyKey, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
  inter: "'Inter', system-ui, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
};

export const DEFAULTS: Settings = {
  fontFamily: 'system',
  fontSize: 16,
  lineHeight: 1.7,
  letterSpacing: 0,
  contentWidth: 860,
  paragraphSpacing: 1,
  justify: false,
  textColor: '#1f2328',
  bgColor: '#ffffff',
  accentColor: '#0969da',
  headingColor: '#0969da',
  linkColor: '#0969da',
  linkUnderline: 'hover',
  codeFontSize: 13.5,
  codeTheme: 'auto',
  mermaidTheme: 'auto',
  theme: 'light',
};

// Presets integrados: esquemas de color parciales (se mezclan sobre el estado).
export const PRESETS: Record<string, Partial<Settings>> = {
  default: { theme: 'light', textColor: '#1f2328', bgColor: '#ffffff', accentColor: '#0969da', headingColor: '#0969da', linkColor: '#0969da' },
  sepia: { theme: 'light', textColor: '#433422', bgColor: '#f4ecd8', accentColor: '#9a5b2e', headingColor: '#7b4a24', linkColor: '#9a5b2e' },
  night: { theme: 'dark', textColor: '#c9d1d9', bgColor: '#0d1117', accentColor: '#58a6ff', headingColor: '#79c0ff', linkColor: '#58a6ff' },
  contrast: { theme: 'light', textColor: '#000000', bgColor: '#ffffff', accentColor: '#0033cc', headingColor: '#000000', linkColor: '#0033cc' },
};

export const BUILTIN_LABELS: Record<string, string> = {
  default: 'Default',
  sepia: 'Sepia',
  night: 'Night',
  contrast: 'Alto contraste',
};

export function resolveFontFamily(v: string): string {
  return FONT_FAMILIES[v as FontFamilyKey] || v;
}

// Mermaid no acepta "auto": lo resolvemos según el tema claro/oscuro.
export function resolveMermaidTheme(s: Settings): string {
  if (s.mermaidTheme && s.mermaidTheme !== 'auto') return s.mermaidTheme;
  return s.theme === 'dark' ? 'dark' : 'default';
}

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}
function persistSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* almacenamiento no disponible: best-effort */
  }
}
function loadPresets(): CustomPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
  } catch {
    return [];
  }
}
function persistPresets(list: CustomPreset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* best-effort */
  }
}

interface SettingsState {
  settings: Settings;
  presets: CustomPreset[];
  /** Aplica un cambio parcial (mergea y persiste). */
  patch: (partial: Partial<Settings>) => void;
  /** Reemplaza todo el objeto de settings. */
  replace: (settings: Settings) => void;
  /** Resetea a los valores por defecto. */
  reset: () => void;
  /** Cambia rápido entre claro/oscuro reusando los presets default/night. */
  toggleTheme: () => void;
  savePreset: (name: string) => void;
  deletePreset: (index: number) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: loadSettings(),
  presets: loadPresets(),

  patch: (partial) => {
    const next = { ...get().settings, ...partial };
    persistSettings(next);
    set({ settings: next });
  },
  replace: (settings) => {
    persistSettings(settings);
    set({ settings });
  },
  reset: () => {
    const next = { ...DEFAULTS };
    persistSettings(next);
    set({ settings: next });
  },
  toggleTheme: () => {
    const cur = get().settings;
    const nextMode: ThemeMode = cur.theme === 'dark' ? 'light' : 'dark';
    const preset = PRESETS[nextMode === 'dark' ? 'night' : 'default'];
    const next = { ...cur, ...preset, theme: nextMode };
    persistSettings(next);
    set({ settings: next });
  },
  savePreset: (name) => {
    const list = [...get().presets];
    const entry: CustomPreset = { name, settings: { ...get().settings } };
    const existing = list.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing >= 0) list[existing] = entry;
    else list.push(entry);
    persistPresets(list);
    set({ presets: list });
  },
  deletePreset: (index) => {
    const list = [...get().presets];
    list.splice(index, 1);
    persistPresets(list);
    set({ presets: list });
  },
}));
