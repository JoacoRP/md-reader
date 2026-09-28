import { create } from 'zustand';
import { api, mockUrl, type AppId, type FileKind, type TemplateInfo, type TreeDir, type TreeFile } from '../api/client';
import { useTree } from './treeStore';
import { alertDialog, confirmDialog, promptDialog } from './dialogStore';

// Documentos abiertos (pestañas internas) y sub-app activa (reader / notes).
//
// Cada pestaña es autosuficiente: sabe a qué sub-app pertenece y guarda su propio
// contenido, borrador, estado de guardado y posición de scroll. Por eso una nota
// de Note Taker y un documento del lector pueden convivir abiertas: cada llamada
// a la API va con el `app` de SU pestaña, no con el global.
//
// La pestaña ACTIVA se refleja en la URL (`?app=` + hash con la ruta), que es el
// contrato que ya usaban la página /mermaid y los links externos, y lo que permite
// abrir un documento en otra ventana.

const APP_KEY = 'md-reader-app';
const RAW_KEY = 'md-reader-raw';

export type SaveStatus = 'hidden' | 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

/** Un documento abierto. */
export interface Tab {
  id: string;
  app: AppId;
  path: string;
  kind: FileKind;
  content: string | null; // null = todavía no cargado (las de fondo son perezosas)
  mtime: number;
  draft: string | null; // texto en vivo del editor (para autosave al salir)
  forceEditOnce: boolean; // nota nueva: abre directo en edición
  saveStatus: SaveStatus;
  scrollTop: number; // posición de lectura, para volver donde estabas
  error: string | null; // el archivo ya no existe / no se pudo leer
}

// La sub-app activa es identidad POR VENTANA (o pestaña del browser): vive en el
// query param `?app=` de la URL, propio de cada una y estable ante reload o
// descarte de pestañas en 2º plano (a diferencia de localStorage, que es global al
// origen y hacía que una ventana "heredara" la app de otra al recargarse).
// localStorage queda sólo como *semilla* del default para ventanas NUEVAS
// (recuerda la última herramienta usada), sin tocar a las que ya están abiertas.
function parseApp(v: string | null): AppId | null {
  return v === 'notes' || v === 'reader' ? v : null;
}

function appFromUrl(): AppId | null {
  return parseApp(new URLSearchParams(window.location.search).get('app'));
}

// replaceState en vez de asignar location.hash / location.search: no navega, y no
// apila una entrada de historial por cada cambio de pestaña.
function replaceUrl(url: URL): void {
  window.history.replaceState(window.history.state, '', url);
}

// Sólo la herramienta activa. Deja el hash intacto: al cargar la app todavía puede
// traer el archivo a abrir (link externo, ventana nueva, reload).
function writeAppToUrl(app: AppId): void {
  const url = new URL(window.location.href);
  url.searchParams.set('app', app);
  replaceUrl(url);
}

// Identidad completa del documento activo: `?app=` + hash con la ruta. Con
// path = null (no quedan pestañas) limpia el hash.
function syncUrl(app: AppId, path: string | null): void {
  const url = new URL(window.location.href);
  url.searchParams.set('app', app);
  url.hash = path ? encodeURIComponent(path) : '';
  replaceUrl(url);
}

function setDocTitle(path: string | null): void {
  document.title = path ? path.split('/').pop() + ' — Markdown Reader' : 'Markdown Reader';
}

// Valor inicial: manda la URL; si no trae `?app=`, la última usada (localStorage);
// si no, reader. Sembramos la URL con el valor resuelto para que la ventana quede
// autodescripta y un reload la mantenga.
const initialApp: AppId = appFromUrl() ?? parseApp(localStorage.getItem(APP_KEY)) ?? 'reader';
writeAppToUrl(initialApp);

function inferKind(path: string): FileKind {
  if (/\.(html?|htm)$/i.test(path)) return 'html';
  if (/\.txt$/i.test(path)) return 'txt';
  return 'md';
}

let tabSeq = 0;

function createTab(app: AppId, path: string, kind: FileKind, editFirst: boolean): Tab {
  return {
    id: `t${Date.now().toString(36)}-${(tabSeq++).toString(36)}`,
    app,
    path,
    kind,
    content: null,
    mtime: 0,
    draft: null,
    forceEditOnce: editFirst,
    saveStatus: 'hidden',
    scrollTop: 0,
    error: null,
  };
}

/** La pestaña activa, o null si no hay ninguna abierta. */
export function selectActiveTab(s: AppState): Tab | null {
  return s.tabs.find((t) => t.id === s.activeTabId) ?? null;
}

export interface OpenOpts {
  /** Abrir en edición directa (nota nueva). */
  editFirst?: boolean;
  /** Abrir en una pestaña nueva en vez de reemplazar el documento activo. */
  newTab?: boolean;
  /** Con newTab: dejarla en segundo plano, sin quitarle el foco al documento actual. */
  background?: boolean;
}

interface AppState {
  activeApp: AppId;
  tabs: Tab[];
  activeTabId: string | null;
  rawMode: boolean; // toggle global raw/formateado
  templates: TemplateInfo[];

  setApp: (app: AppId) => Promise<void>;
  openFile: (path: string, kind?: FileKind, opts?: OpenOpts) => Promise<void>;
  activateTab: (id: string) => Promise<void>;
  closeTab: (id: string, opts?: { discard?: boolean }) => Promise<void>;
  closeTabsOfApp: (app: AppId) => Promise<void>;
  cycleTab: (delta: number) => Promise<void>;
  setTabScroll: (id: string, top: number) => void;
  ensureContent: (tabId?: string) => Promise<boolean>;
  toggleRaw: () => Promise<void>;
  setEditorContent: (text: string) => void;
  flushRawEdits: (tabId?: string) => Promise<void>;
  flushAllTabs: () => Promise<void>;

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


export const useApp = create<AppState>((set, get) => {
  // Parche inmutable de una pestaña por id.
  const patch = (id: string, p: Partial<Tab>) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...p } : t)) }));

  return {
    activeApp: initialApp,
    tabs: [],
    activeTabId: null,
    rawMode: localStorage.getItem(RAW_KEY) === '1',
    templates: [],

    // Cambia la herramienta del panel lateral (árbol + branding). Las pestañas
    // abiertas no se tocan: cada una sabe a qué sub-app pertenece, así que una
    // nota sigue siendo legible aunque el árbol muestre el lector.
    setApp: async (app) => {
      if (app === get().activeApp) return;
      await get().flushRawEdits();
      localStorage.setItem(APP_KEY, app); // semilla del default para ventanas nuevas
      set({ activeApp: app });
      // Sin documento abierto, el `?app=` de la URL describe a la herramienta.
      if (!selectActiveTab(get())) writeAppToUrl(app);
    },

    openFile: async (path, kind, opts = {}) => {
      if (!path) return;
      const app = get().activeApp;
      const resolved = kind || inferKind(path);

      // Un archivo ya abierto no se duplica: dos pestañas del mismo documento
      // serían dos borradores peleándose por el autosave.
      const open = get().tabs.find((t) => t.app === app && t.path === path);
      if (open) {
        if (!opts.background) await get().activateTab(open.id);
        return;
      }

      const active = selectActiveTab(get());
      const tab = createTab(app, path, resolved, !!opts.editFirst);

      if (opts.newTab || !active) {
        set((s) => ({ tabs: [...s.tabs, tab] }));
        // En segundo plano queda sin contenido hasta que la activás: abrir diez
        // archivos con la rueda no dispara diez fetches.
        if (opts.background && active) return;
        await get().activateTab(tab.id);
        return;
      }

      // Click simple: el documento reemplaza al de la pestaña activa.
      await get().flushRawEdits(active.id);
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === active.id ? { ...tab, id: t.id } : t)) }));
      await get().activateTab(active.id);
    },

    activateTab: async (id) => {
      const prev = get().activeTabId;
      if (prev && prev !== id) await get().flushRawEdits(prev);
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab) return;
      // La pestaña manda: si es de otra sub-app, el árbol y el branding la siguen.
      if (tab.app !== get().activeApp) {
        localStorage.setItem(APP_KEY, tab.app);
        set({ activeApp: tab.app });
      }
      set({ activeTabId: id });
      syncUrl(tab.app, tab.path);
      setDocTitle(tab.path);
      // Los mocks HTML formateados se sirven por iframe: no hace falta el texto.
      if (tab.kind !== 'html') await get().ensureContent(id);
    },

    // discard: cerrar sin guardar (el archivo se borró; guardarlo lo recrearía).
    closeTab: async (id, opts = {}) => {
      if (!opts.discard) await get().flushRawEdits(id);
      const st = get();
      const idx = st.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const tabs = st.tabs.filter((t) => t.id !== id);
      const wasActive = st.activeTabId === id;
      set({ tabs, activeTabId: wasActive ? null : st.activeTabId });
      if (!wasActive) return;
      // Pasa el foco a la de la derecha; si era la última, a la de la izquierda.
      const next = tabs[idx] || tabs[idx - 1];
      if (next) {
        await get().activateTab(next.id);
      } else {
        syncUrl(get().activeApp, null);
        setDocTitle(null);
      }
    },

    // Cierra las pestañas de una sub-app SIN guardar: se llama cuando cambió su
    // raíz y los paths relativos ya no son válidos (guardarlos escribiría en la
    // carpeta nueva). El guardado va antes, en quien cambia la raíz.
    closeTabsOfApp: async (app) => {
      const st = get();
      const tabs = st.tabs.filter((t) => t.app !== app);
      const active = selectActiveTab(st);
      const keep = active && active.app !== app ? active.id : null;
      set({ tabs, activeTabId: keep });
      if (keep) return;
      const last = tabs[tabs.length - 1];
      if (last) {
        await get().activateTab(last.id);
      } else {
        syncUrl(get().activeApp, null);
        setDocTitle(null);
      }
    },

    cycleTab: async (delta) => {
      const st = get();
      if (st.tabs.length < 2) return;
      const i = st.tabs.findIndex((t) => t.id === st.activeTabId);
      if (i === -1) return;
      const len = st.tabs.length;
      await get().activateTab(st.tabs[(((i + delta) % len) + len) % len].id);
    },

    setTabScroll: (id, top) => patch(id, { scrollTop: top }),

    ensureContent: async (tabId) => {
      const id = tabId ?? get().activeTabId;
      if (!id) return false;
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab) return false;
      if (tab.content != null) return true;
      try {
        if (tab.kind === 'html') {
          // Los mocks HTML se sirven crudos por /mock/ (no por /api/file, que sólo
          // acepta md/txt). Así el "raw" muestra el código fuente del HTML.
          const res = await fetch(mockUrl(tab.path));
          if (!res.ok) throw new Error('No se pudo cargar el archivo.');
          patch(id, { content: await res.text(), mtime: 0, error: null });
        } else {
          const data = await api.getFile(tab.path, tab.app);
          patch(id, { content: data.content, mtime: data.mtime, error: null });
        }
        return true;
      } catch (e) {
        // Suele ser un archivo movido o borrado por fuera: mejor decirlo que
        // dejar la pestaña en blanco.
        patch(id, { error: e instanceof Error ? e.message : 'No se pudo abrir el archivo.' });
        return false;
      }
    },

    toggleRaw: async () => {
      const st = get();
      const tab = selectActiveTab(st);
      // Nota .md abierta en edición directa (edit-first): el toggle va a formateado.
      if (tab?.forceEditOnce && !st.rawMode) {
        await st.flushRawEdits(tab.id);
        patch(tab.id, { forceEditOnce: false });
        return;
      }
      if (st.rawMode && tab) await st.flushRawEdits(tab.id); // saliendo del editor → guardar
      const next = !st.rawMode;
      localStorage.setItem(RAW_KEY, next ? '1' : '0');
      set({ rawMode: next });
      if (tab) patch(tab.id, { forceEditOnce: false });
    },

    setEditorContent: (text) => {
      const tab = selectActiveTab(get());
      if (!tab) return;
      patch(tab.id, { draft: text, saveStatus: text !== tab.content ? 'dirty' : 'clean' });
    },

    flushRawEdits: async (tabId) => {
      const id = tabId ?? get().activeTabId;
      if (!id) return;
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab || tab.draft == null || tab.draft === tab.content) return;
      const val = tab.draft;
      patch(id, { saveStatus: 'saving' });
      try {
        const data = await api.save(tab.path, val, tab.app);
        patch(id, { content: val, mtime: data.mtime, saveStatus: 'saved' });
      } catch {
        patch(id, { saveStatus: 'error' });
      }
    },

    flushAllTabs: async () => {
      for (const t of get().tabs) await get().flushRawEdits(t.id);
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
      const app = get().activeApp;
      const tab = get().tabs.find((t) => t.app === app && t.path === path);
      if (tab) await get().flushRawEdits(tab.id);
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
        await useTree.getState().loadTree(app);
        // El contenido no cambió: alcanza con reapuntar la pestaña (sin recargar,
        // así conserva el scroll). El server rechaza renombrar sobre un archivo
        // existente, así que no puede colisionar con otra pestaña abierta.
        if (tab) {
          patch(tab.id, { path: data.path, kind: data.kind });
          if (get().activeTabId === tab.id) {
            syncUrl(tab.app, data.path);
            setDocTitle(data.path);
          }
        }
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
        await useTree.getState().loadTree(app);
        const tab = get().tabs.find((t) => t.app === app && t.path === path);
        // discard: guardar el borrador recrearía el archivo que acabamos de borrar.
        if (tab) await get().closeTab(tab.id, { discard: true });
      } catch (e) {
        await alertDialog({ title: 'No se pudo eliminar', message: e instanceof Error ? e.message : '' });
      }
    },
  };
});

// Crea una nota vía /api/create en `dir` (relativo a la raíz de notas; el server
// crea la subcarpeta si no existe), refresca el árbol y la abre en una pestaña
// nueva en edición, sin pisar el documento que estabas leyendo.
async function createNote(get: () => AppState, name: string, content: string, dir: string): Promise<void> {
  const app = get().activeApp;
  try {
    const data = await api.create(dir, name, content, app);
    await useTree.getState().loadTree(app);
    await get().openFile(data.path, data.kind, { editFirst: true, newTab: true });
  } catch (e) {
    await alertDialog({ title: 'No se pudo crear', message: e instanceof Error ? e.message : 'No se pudo crear la nota.' });
  }
}
