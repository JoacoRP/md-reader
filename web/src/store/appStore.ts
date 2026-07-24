import { create } from 'zustand';
import { api, mockUrl, type AppId, type FileKind, type TemplateInfo, type TreeDir, type TreeFile } from '../api/client';
import { useTree } from './treeStore';
import { alertDialog, confirmDialog, promptDialog } from './dialogStore';

// Estado del documento activo y de la sub-app (reader / notes). Mirror del estado
// imperativo de public/app.js, ahora reactivo. La edición/autosave (Fase 4) usa
// los mismos campos (currentContent, saveStatus, forceEditOnce).

const APP_KEY = 'md-reader-app';
const RAW_KEY = 'md-reader-raw';

export type SaveStatus = 'hidden' | 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

// La sub-app activa es identidad POR PESTAÑA: vive en el query param `?app=` de la
// URL, propio de cada pestaña y estable ante reload o descarte de pestañas en 2º
// plano (a diferencia de localStorage, que es global al origen y hacía que una
// pestaña "heredara" la app de otra al recargarse). localStorage queda sólo como
// *semilla* del default para pestañas NUEVAS (recuerda la última herramienta usada),
// sin tocar a las pestañas ya abiertas.
function parseApp(v: string | null): AppId | null {
  return v === 'notes' || v === 'reader' ? v : null;
}

function appFromUrl(): AppId | null {
  return parseApp(new URLSearchParams(window.location.search).get('app'));
}

function writeAppToUrl(app: AppId): void {
  const url = new URL(window.location.href);
  url.searchParams.set('app', app);
  // replaceState (en vez de asignar location.search, que recargaría) para no navegar
  // y preservar el hash con el archivo abierto.
  window.history.replaceState(window.history.state, '', url);
}

// Valor inicial: manda la URL; si no trae `?app=`, la última usada (localStorage); si
// no, reader. Sembramos la URL con el valor resuelto para que la pestaña quede
// autodescripta y un reload la mantenga.
const initialApp: AppId = appFromUrl() ?? parseApp(localStorage.getItem(APP_KEY)) ?? 'reader';
writeAppToUrl(initialApp);

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
  templates: TemplateInfo[];

  isNotes: () => boolean;
  setApp: (app: AppId) => Promise<void>;
  openFile: (path: string, kind?: FileKind, opts?: { editFirst?: boolean }) => Promise<void>;
  closeFile: () => void;
  ensureContent: () => Promise<boolean>;
  toggleRaw: () => Promise<void>;
  setEditorContent: (text: string) => void;
  flushRawEdits: () => Promise<void>;

  // --- Note Taker ---
  loadTemplates: () => Promise<void>;
  newBlankNote: () => Promise<void>;
  newFromTemplate: (file: string) => Promise<void>;
  renameFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Carpeta destino (relativa a la raíz de notas) según la plantilla usada.
// Las notas en blanco van a la raíz; las plantillas conocidas a su subcarpeta.
function templateTargetDir(file: string): string {
  const base = file.replace(/\.[^.]+$/, '').toLowerCase();
  if (/daily|diaria/.test(base)) return 'Dailys';
  if (/reuni[oó]n|meeting/.test(base)) return 'Reuniones';
  return ''; // otras plantillas: raíz de notas
}

// Reemplaza placeholders de plantilla por la fecha/hora local al crear.
function applyPlaceholders(text: string): string {
  const now = new Date();
  const date = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return text
    .replace(/\{\{\s*datetime\s*\}\}/gi, `${date} ${time}`)
    .replace(/\{\{\s*date\s*\}\}/gi, date)
    .replace(/\{\{\s*time\s*\}\}/gi, time);
}

// Secciones de la Daily que se heredan de la anterior al crear una nueva.
const DAILY_CARRY_SECTIONS = ['Mío', 'Notas'];

function isDailyTemplate(file: string): boolean {
  return /daily|diaria/.test(file.replace(/\.[^.]+$/, '').toLowerCase());
}

// Extrae el bloque "## <heading>" (encabezado incluido) hasta el próximo "## "
// o el fin del documento, sin blancos finales. null si la sección no existe.
function extractSection(md: string, heading: string): string | null {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').replace(/\s+$/, '');
}

// Reemplaza el bloque "## <heading>" por `replacement` (encabezado incluido).
// Si la sección no existe en el doc, lo devuelve sin cambios.
function replaceSection(md: string, heading: string, replacement: string): string {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return md;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const before = lines.slice(0, start);
  const after = lines.slice(end);
  const sep = after.length ? [''] : []; // una línea en blanco antes de la próxima sección
  return [...before, ...replacement.split('\n'), ...sep, ...after].join('\n');
}

// Para una Daily nueva: hereda "Mío" y "Notas" de la última Daily (la .md más
// reciente en Dailys/). Best-effort: ante cualquier falla devuelve el contenido
// del template sin tocar.
async function carryOverDailySections(content: string): Promise<string> {
  try {
    const { tree } = await api.getTree('notes');
    const dailys = tree.children.find((c): c is TreeDir => c.type === 'dir' && c.name === 'Dailys');
    if (!dailys) return content;
    const files = dailys.children.filter((c): c is TreeFile => c.type === 'file' && c.kind === 'md');
    if (!files.length) return content;
    const last = files.reduce((a, b) => (b.mtime > a.mtime ? b : a));
    const data = await api.getFile(last.path, 'notes');
    let out = content;
    for (const heading of DAILY_CARRY_SECTIONS) {
      const section = extractSection(data.content, heading);
      if (section) out = replaceSection(out, heading, section);
    }
    return out;
  } catch {
    return content;
  }
}

export const useApp = create<AppState>((set, get) => ({
  activeApp: initialApp,
  currentPath: null,
  currentKind: 'md',
  currentContent: null,
  currentMtime: 0,
  draft: null,
  rawMode: localStorage.getItem(RAW_KEY) === '1',
  forceEditOnce: false,
  saveStatus: 'hidden',
  templates: [],

  isNotes: () => get().activeApp === 'notes',

  setApp: async (app) => {
    if (app === get().activeApp) return;
    await get().flushRawEdits();
    localStorage.setItem(APP_KEY, app); // semilla del default para pestañas nuevas
    writeAppToUrl(app); // identidad de ESTA pestaña (no afecta a las demás)
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
      if (st.currentKind === 'html') {
        // Los mocks HTML se sirven crudos por /mock/ (no por /api/file, que sólo
        // acepta md/txt). Así el "raw" muestra el código fuente del HTML.
        const res = await fetch(mockUrl(st.currentPath));
        if (!res.ok) throw new Error('No se pudo cargar el archivo');
        set({ currentContent: await res.text(), currentMtime: 0 });
      } else {
        const data = await api.getFile(st.currentPath, st.activeApp);
        set({ currentContent: data.content, currentMtime: data.mtime });
      }
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

  loadTemplates: async () => {
    try {
      const data = await api.getTemplates(get().activeApp);
      set({ templates: data.templates || [] });
    } catch {
      set({ templates: [] });
    }
  },

  newBlankNote: async () => {
    const name = await promptDialog({
      title: 'Nueva nota',
      label: 'Nombre de la nota (se crea como .md)',
      confirmText: 'Crear',
    });
    if (name) await createNote(get, name, '', ''); // nota en blanco -> raíz de notas
  },

  newFromTemplate: async (file) => {
    const app = get().activeApp;
    let content = '';
    try {
      const data = await api.getFile('templates/' + file, app);
      content = applyPlaceholders(data.content);
    } catch {
      await alertDialog({ title: 'Error', message: 'No se pudo leer la plantilla.' });
      return;
    }
    const base = file.replace(/\.[^.]+$/, '');
    const now = new Date();
    const suggested = `${base}_${now.getFullYear()}_${pad2(now.getMonth() + 1)}_${pad2(now.getDate())}`;
    const name = await promptDialog({
      title: 'Nueva nota desde plantilla',
      label: 'Nombre de la nota',
      value: suggested,
      confirmText: 'Crear',
    });
    if (!name) return;
    // Daily nueva: arrastra "Mío" y "Notas" de la última Daily.
    if (isDailyTemplate(file)) content = await carryOverDailySections(content);
    await createNote(get, name, content, templateTargetDir(file));
  },

  renameFile: async (path) => {
    if (!path) return;
    await get().flushRawEdits();
    const app = get().activeApp;
    const oldName = path.split('/').pop() || '';
    const newName = await promptDialog({
      title: 'Renombrar archivo',
      label: 'Nuevo nombre',
      value: oldName,
      confirmText: 'Renombrar',
    });
    if (!newName || newName === oldName) return;
    try {
      const data = await api.rename(path, newName, app);
      const wasOpen = get().currentPath === path;
      await useTree.getState().loadTree(app);
      if (wasOpen) await get().openFile(data.path, data.kind);
    } catch (e) {
      await alertDialog({ title: 'No se pudo renombrar', message: e instanceof Error ? e.message : '' });
    }
  },

  deleteFile: async (path) => {
    if (!path) return;
    const app = get().activeApp;
    const name = path.split('/').pop() || '';
    const ok = await confirmDialog({
      title: 'Eliminar nota',
      message: `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.remove(path, app);
      const wasOpen = get().currentPath === path;
      await useTree.getState().loadTree(app);
      if (wasOpen) get().closeFile();
    } catch (e) {
      await alertDialog({ title: 'No se pudo eliminar', message: e instanceof Error ? e.message : '' });
    }
  },
}));

// Crea una nota vía /api/create en `dir` (relativo a la raíz de notas; el server
// crea la subcarpeta si no existe), refresca el árbol y la abre en edición.
async function createNote(get: () => AppState, name: string, content: string, dir: string): Promise<void> {
  const app = get().activeApp;
  try {
    const data = await api.create(dir, name, content, app);
    await useTree.getState().loadTree(app);
    await get().openFile(data.path, data.kind, { editFirst: true });
  } catch (e) {
    await alertDialog({ title: 'No se pudo crear', message: e instanceof Error ? e.message : 'No se pudo crear la nota.' });
  }
}
