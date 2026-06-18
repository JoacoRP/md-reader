import { create } from 'zustand';
import { api, type AppId, type FileKind } from '../api/client';

// Estado del documento activo y de la sub-app (reader / notes). Mirror del estado
// imperativo de public/app.js, ahora reactivo. La edición/autosave (Fase 4) usa
// los mismos campos (currentContent, saveStatus, forceEditOnce).

const APP_KEY = 'md-reader-app';
const RAW_KEY = 'md-reader-raw';

export type SaveStatus = 'hidden' | 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

function inferKind(path: string): FileKind {
  if (/\.(html?|htm)$/i.test(path)) return 'html';
  if (/\.txt$/i.test(path)) return 'txt';
  return 'md';
}

interface AppState {
  activeApp: AppId;
  currentPath: string | null;
  currentKind: FileKind;
  currentContent: string | null; // texto crudo cacheado (md/txt/html en edición)
  currentMtime: number;
  draft: string | null; // texto en vivo del editor (para autosave al cambiar de archivo)
  rawMode: boolean; // toggle global raw/formateado
  forceEditOnce: boolean; // abrir una nota nueva directo en edición
  saveStatus: SaveStatus;

  isNotes: () => boolean;
  setApp: (app: AppId) => Promise<void>;
  openFile: (path: string, kind?: FileKind, opts?: { editFirst?: boolean }) => Promise<void>;
  closeFile: () => void;
  ensureContent: () => Promise<boolean>;
  toggleRaw: () => Promise<void>;
  setEditorContent: (text: string) => void;
  flushRawEdits: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  activeApp: localStorage.getItem(APP_KEY) === 'notes' ? 'notes' : 'reader',
  currentPath: null,
  currentKind: 'md',
  currentContent: null,
  currentMtime: 0,
  draft: null,
  rawMode: localStorage.getItem(RAW_KEY) === '1',
  forceEditOnce: false,
  saveStatus: 'hidden',

  isNotes: () => get().activeApp === 'notes',

  setApp: async (app) => {
    if (app === get().activeApp) return;
    await get().flushRawEdits();
    localStorage.setItem(APP_KEY, app);
    const st = get();
    // Si el archivo abierto no pertenece a la app nueva (un .txt en el lector), cerralo.
    const closing = app !== 'notes' && st.currentKind === 'txt';
    set({
      activeApp: app,
      ...(closing
        ? { currentPath: null, currentContent: null, currentMtime: 0, forceEditOnce: false, saveStatus: 'hidden' as SaveStatus }
        : {}),
    });
    if (closing) location.hash = '';
  },

  openFile: async (path, kind, opts = {}) => {
    if (!path) return;
    await get().flushRawEdits();
    const k = kind || inferKind(path);
    set({
      currentPath: path,
      currentKind: k,
      currentContent: null,
      currentMtime: 0,
      draft: null,
      forceEditOnce: !!opts.editFirst,
      saveStatus: 'hidden',
    });
    location.hash = encodeURIComponent(path);
    document.title = path.split('/').pop() + ' — Markdown Reader';
    // HTML formateado se sirve por iframe; no precargamos contenido salvo edición.
    if (k !== 'html') await get().ensureContent();
  },

  closeFile: () => {
    set({
      currentPath: null,
      currentKind: 'md',
      currentContent: null,
      currentMtime: 0,
      draft: null,
      forceEditOnce: false,
      saveStatus: 'hidden',
    });
    location.hash = '';
    document.title = 'Markdown Reader';
  },

  ensureContent: async () => {
    const st = get();
    if (st.currentContent != null || !st.currentPath) return st.currentContent != null;
    try {
      const data = await api.getFile(st.currentPath, st.activeApp);
      set({ currentContent: data.content, currentMtime: data.mtime });
      return true;
    } catch {
      return false;
    }
  },

  toggleRaw: async () => {
    const st = get();
    // Nota .md abierta en edición directa (edit-first): el toggle va a formateado.
    if (st.forceEditOnce && !st.rawMode) {
      await st.flushRawEdits();
      set({ forceEditOnce: false });
      return;
    }
    if (st.rawMode) await st.flushRawEdits(); // saliendo del editor → guardar
    const next = !st.rawMode;
    localStorage.setItem(RAW_KEY, next ? '1' : '0');
    set({ rawMode: next, forceEditOnce: false });
  },

  setEditorContent: (text) => {
    const st = get();
    set({ draft: text, saveStatus: text !== st.currentContent ? 'dirty' : 'clean' });
  },

  flushRawEdits: async () => {
    const st = get();
    if (st.draft == null || !st.currentPath) return;
    if (st.draft === st.currentContent) return;
    const val = st.draft;
    set({ saveStatus: 'saving' });
    try {
      const data = await api.save(st.currentPath, val, st.activeApp);
      set({ currentContent: val, currentMtime: data.mtime, saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  },
}));
