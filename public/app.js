'use strict';

/* ============================ State & DOM ============================ */
const $ = (sel) => document.querySelector(sel);
const treeEl = $('#tree');
const contentEl = $('#content');
const tocEl = $('#toc');
const breadcrumbEl = $('#breadcrumb');
const fileMetaEl = $('#file-meta');
const rootLabelEl = $('#root-label');

let currentPath = null;
let treeData = null;
let settings = MDConfig.load();

/* ============================ Markdown rendering ============================ */
async function renderMarkdown(md) {
  contentEl.innerHTML = MDCore.toSafeHtml(md);
  enhanceContent();
  MDCore.attachCopyButtons(contentEl);
  await MDCore.renderMermaidIn(contentEl, MDConfig.resolveMermaidTheme(settings));
  buildTOC();
  contentEl.parentElement.scrollTop = 0;
}

function enhanceContent() {
  // External links open in a new tab; internal anchors scroll smoothly;
  // relative .md links load in-app.
  contentEl.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href.startsWith('#')) {
      a.addEventListener('click', (e) => {
        const el = document.getElementById(decodeURIComponent(href.slice(1)));
        if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    } else if (/^https?:\/\//.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else if (/\.(md|markdown|mdx)$/i.test(href)) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openFile(resolveRelative(currentPath, href));
      });
    }
  });

  // Rewrite relative <img> sources to be fetched through the server.
  contentEl.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!/^(https?:|data:|\/)/.test(src)) {
      img.src = '/api/raw?path=' + encodeURIComponent(resolveRelative(currentPath, src));
    }
  });
}

function resolveRelative(fromFile, rel) {
  const base = (fromFile || '').split('/').slice(0, -1);
  for (const part of rel.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return base.join('/');
}

/* ============================ Table of contents ============================ */
let tocLinks = [];

function buildTOC() {
  const headings = contentEl.querySelectorAll('h1, h2, h3, h4');
  if (headings.length < 2) { tocEl.classList.add('hidden'); tocLinks = []; return; }

  let html = '<div class="toc-title">Contenido</div>';
  headings.forEach((h) => {
    const lvl = Number(h.tagName[1]);
    html += `<a href="#${h.id}" class="lvl-${lvl}" data-target="${h.id}">${MDCore.stripTags(h.innerHTML).replace('#', '')}</a>`;
  });
  tocEl.innerHTML = html;

  tocLinks = Array.from(tocEl.querySelectorAll('a'));
  tocLinks.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(a.dataset.target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  if ($('#toc-btn').dataset.on !== 'off') tocEl.classList.remove('hidden');
}

// Highlight current heading in the TOC while scrolling.
function updateActiveTOC() {
  if (!tocLinks.length) return;
  const scrollTop = $('#content-wrap').scrollTop;
  let activeId = null;
  contentEl.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
    if (h.offsetTop - 90 <= scrollTop) activeId = h.id;
  });
  tocLinks.forEach((a) => a.classList.toggle('active', a.dataset.target === activeId));
}

/* ============================ File tree ============================ */
let defaultRoot = null;

async function loadTree() {
  const res = await fetch('/api/tree');
  const data = await res.json();
  treeData = data.tree;
  defaultRoot = data.default;
  rootLabelEl.textContent = data.root;
  rootLabelEl.title = data.root;
  const rootInput = $('#root-input');
  if (document.activeElement !== rootInput) rootInput.value = data.root;
  treeEl.innerHTML = '';
  if (!treeData.children.length) {
    treeEl.innerHTML = '<div class="tree-empty">Sin archivos .md en esta carpeta.</div>';
  } else {
    treeData.children.forEach((child) => treeEl.appendChild(renderNode(child, 0)));
  }
}

// Change the scan root server-side, then refresh the tree.
async function changeRoot(newPath) {
  const errEl = $('#root-error');
  errEl.textContent = '';
  const target = (newPath || '').trim();
  if (!target) return;
  try {
    const res = await fetch('/api/root', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'No se pudo cambiar la raíz.'; return; }
    // El archivo abierto pertenecía a la raíz anterior: limpiar la vista.
    currentPath = null;
    currentContent = null;
    location.hash = '';
    document.title = 'Markdown Reader';
    breadcrumbEl.textContent = '';
    fileMetaEl.textContent = '';
    tocEl.classList.add('hidden');
    contentEl.classList.remove('mock-view');
    $('#raw-btn').classList.add('hidden');
    $('#open-tab-btn').classList.add('hidden');
    contentEl.innerHTML = '<div class="empty-state"><h1><i class="bi bi-folder2-open"></i> Raíz actualizada</h1>' +
      `<p>Mostrando los <code>.md</code> / <code>.html</code> bajo:</p><p class="hint">${data.root}</p>` +
      '<p class="hint">Elegí un archivo del panel izquierdo.</p></div>';
    $('#search').value = '';
    await loadTree();
  } catch {
    errEl.textContent = 'Error de conexión con el servidor.';
  }
}

// Ícono (Bootstrap Icons) según el tipo de archivo.
function fileIcon(kind) {
  if (kind === 'html') return '<span class="icon ic-html"><i class="bi bi-filetype-html"></i></span>';
  return '<span class="icon ic-md"><i class="bi bi-filetype-md"></i></span>';
}

function renderNode(node, depth) {
  if (node.type === 'file') {
    const div = document.createElement('div');
    div.className = 'tree-node tree-file';
    div.dataset.path = node.path;
    div.dataset.name = node.name.toLowerCase();
    div.dataset.kind = node.kind || 'md';
    const label = document.createElement('div');
    label.className = 'tree-label';
    label.innerHTML = `<span class="twisty"></span>${fileIcon(node.kind)}<span class="name">${node.name}</span>`;
    label.addEventListener('click', () => openFile(node.path, node.kind));
    div.appendChild(label);
    return div;
  }

  const div = document.createElement('div');
  div.className = 'tree-node tree-dir collapsed'; // todas las carpetas arrancan colapsadas
  div.dataset.name = node.name.toLowerCase();
  const label = document.createElement('div');
  label.className = 'tree-label';
  label.innerHTML = `<span class="twisty">▶</span><span class="icon ic-folder"><i class="bi bi-folder-fill"></i></span><span class="name">${node.name}</span>`;
  label.addEventListener('click', () => {
    div.classList.toggle('collapsed');
    label.querySelector('.twisty').textContent = div.classList.contains('collapsed') ? '▶' : '▼';
  });
  div.appendChild(label);

  const childWrap = document.createElement('div');
  childWrap.className = 'tree-children';
  node.children.forEach((c) => childWrap.appendChild(renderNode(c, depth + 1)));
  div.appendChild(childWrap);
  return div;
}

function setActiveInTree(path) {
  treeEl.querySelectorAll('.tree-label.active').forEach((el) => el.classList.remove('active'));
  const node = treeEl.querySelector(`.tree-file[data-path="${cssEscape(path)}"]`);
  if (node) {
    node.querySelector('.tree-label').classList.add('active');
    let p = node.parentElement;
    while (p && p !== treeEl) {
      if (p.classList.contains('tree-node') && p.classList.contains('collapsed')) {
        p.classList.remove('collapsed');
        const tw = p.querySelector(':scope > .tree-label .twisty');
        if (tw) tw.textContent = '▼';
      }
      p = p.parentElement;
    }
    node.scrollIntoView({ block: 'nearest' });
  }
}

function cssEscape(s) { return s.replace(/["\\]/g, '\\$&'); }

/* ============================ Search filter ============================ */
let searchMode = 'files'; // 'files' | 'folders'

function collapseDir(d, collapsed) {
  d.classList.toggle('collapsed', collapsed);
  const tw = d.querySelector(':scope > .tree-label .twisty');
  if (tw) tw.textContent = collapsed ? '▶' : '▼';
}

function setSearchMode(mode) {
  searchMode = mode;
  $('#mode-files').classList.toggle('active', mode === 'files');
  $('#mode-folders').classList.toggle('active', mode === 'folders');
  $('#search').placeholder = mode === 'files' ? 'Buscar archivo…' : 'Buscar carpeta…';
  filterTree($('#search').value);
}

function filterTree(query) {
  if (searchMode === 'folders') return filterFolders(query);
  return filterFiles(query);
}

function filterFiles(query) {
  const q = query.trim().toLowerCase();
  const files = treeEl.querySelectorAll('.tree-file');
  if (!q) {
    files.forEach((f) => f.classList.remove('hidden'));
    treeEl.querySelectorAll('.tree-dir').forEach((d) => { d.classList.remove('hidden'); collapseDir(d, true); });
    return;
  }
  files.forEach((f) => {
    f.classList.toggle('hidden', !f.dataset.path.toLowerCase().includes(q));
  });
  treeEl.querySelectorAll('.tree-dir').forEach((d) => {
    const visibleFiles = d.querySelectorAll('.tree-file:not(.hidden)').length;
    d.classList.toggle('hidden', visibleFiles === 0);
    if (visibleFiles > 0) collapseDir(d, false);
  });
}

// Búsqueda por carpeta: revela las carpetas cuyo nombre matchea, su contenido
// directo (para ver el README, por ejemplo) y la cadena de ancestros.
function filterFolders(query) {
  const q = query.trim().toLowerCase();
  const dirs = treeEl.querySelectorAll('.tree-dir');
  const files = treeEl.querySelectorAll('.tree-file');
  if (!q) {
    files.forEach((f) => f.classList.remove('hidden'));
    dirs.forEach((d) => { d.classList.remove('hidden'); collapseDir(d, true); });
    return;
  }
  dirs.forEach((d) => d.classList.add('hidden'));
  files.forEach((f) => f.classList.add('hidden'));
  dirs.forEach((d) => {
    if ((d.dataset.name || '').includes(q)) revealDir(d);
  });
}

function revealDir(d) {
  d.classList.remove('hidden');
  collapseDir(d, false); // expandir la carpeta encontrada
  // contenido (descendientes): visibles; subcarpetas colapsadas
  d.querySelectorAll('.tree-node').forEach((n) => {
    n.classList.remove('hidden');
    if (n.classList.contains('tree-dir')) collapseDir(n, true);
  });
  // cadena de ancestros: visible y expandida para que sea alcanzable
  let p = d.parentElement;
  while (p && p !== treeEl) {
    if (p.classList.contains('tree-dir')) { p.classList.remove('hidden'); collapseDir(p, false); }
    p = p.parentElement;
  }
}

/* ============================ Load a file ============================ */
let currentKind = 'md';
let currentContent = null;   // texto crudo del archivo actual (cacheado)
let currentMtime = 0;
let rawMode = localStorage.getItem('md-reader-raw') === '1';
let rawEditorEl = null;      // <textarea> del editor raw cuando está activo

function inferKind(path) {
  return /\.(html?|htm)$/i.test(path) ? 'html' : 'md';
}

// Construye la URL /mock/ preservando los separadores de carpeta.
function mockUrl(path) {
  return '/mock/' + path.split('/').map(encodeURIComponent).join('/');
}

// Abre un archivo: fija estado común y delega el render al modo actual.
async function openFile(path, kind) {
  if (!path) return;
  await flushRawEdits(); // autosave de ediciones pendientes del archivo anterior
  currentPath = path;
  currentKind = kind || inferKind(path);
  currentContent = null;
  currentMtime = 0;
  rawEditorEl = null;
  $('#raw-btn').classList.remove('hidden');
  updateBreadcrumb(path);
  setActiveInTree(path);
  document.title = path.split('/').pop() + ' — Markdown Reader';
  location.hash = encodeURIComponent(path);
  await renderCurrent();
}

// Trae el contenido crudo del archivo (markdown vía API, html vía /mock/).
async function ensureContent() {
  if (currentContent != null) return true;
  try {
    if (currentKind === 'html') {
      const res = await fetch(mockUrl(currentPath));
      if (!res.ok) throw new Error('No se pudo cargar el archivo');
      currentContent = await res.text();
    } else {
      const res = await fetch('/api/file?path=' + encodeURIComponent(currentPath));
      if (!res.ok) throw new Error('No se pudo cargar el archivo');
      const data = await res.json();
      currentContent = data.content;
      currentMtime = data.mtime;
    }
    return true;
  } catch (err) {
    contentEl.classList.remove('mock-view');
    contentEl.innerHTML = `<div class="mermaid-error">⚠️ ${err.message}</div>`;
    return false;
  }
}

// Renderiza el archivo actual respetando el tipo (md/html) y el modo (formateado/raw).
async function renderCurrent() {
  updateRawButton();
  if (!rawMode) { rawEditorEl = null; setSaveStatus('hidden'); }

  // HTML formateado → iframe (no necesita traer el contenido).
  if (currentKind === 'html' && !rawMode) {
    contentEl.classList.add('mock-view');
    contentEl.innerHTML = `<iframe class="mock-frame" src="${mockUrl(currentPath)}" title="${currentPath}"></iframe>`;
    tocEl.classList.add('hidden'); tocLinks = [];
    fileMetaEl.innerHTML = '<span class="badge-html"><i class="bi bi-filetype-html"></i> Mock HTML</span>';
    showOpenTab(true);
    contentEl.parentElement.scrollTop = 0;
    return;
  }

  if (!(await ensureContent())) return;
  contentEl.classList.remove('mock-view');

  if (rawMode) {                           // Editor de código (md o html)
    renderRawEditor(currentContent);
    tocEl.classList.add('hidden'); tocLinks = [];
    showOpenTab(currentKind === 'html');
    if (currentKind === 'html') {
      fileMetaEl.innerHTML = '<span class="badge-html"><i class="bi bi-filetype-html"></i> Mock HTML · editando</span>';
    } else {
      fileMetaEl.textContent = formatMeta(currentContent, currentMtime) + ' · editando';
    }
    return;
  }

  // Markdown formateado
  showOpenTab(false);
  await renderMarkdown(currentContent);
  fileMetaEl.textContent = formatMeta(currentContent, currentMtime);
}

// Editor de texto crudo (textarea). Edición libre; el guardado es automático
// al volver a la vista formateada / cambiar de archivo / cerrar.
function renderRawEditor(text) {
  contentEl.innerHTML = '<textarea class="raw-editor" spellcheck="false"></textarea>';
  rawEditorEl = contentEl.querySelector('.raw-editor');
  rawEditorEl.value = text;
  setSaveStatus('clean');
  rawEditorEl.addEventListener('input', () => {
    setSaveStatus(rawEditorEl.value !== currentContent ? 'dirty' : 'clean');
  });
  // Ctrl/Cmd+S fuerza el guardado sin salir del editor.
  rawEditorEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); flushRawEdits();
    }
  });
  contentEl.parentElement.scrollTop = 0;
}

// Guarda las ediciones del editor raw si hay cambios. Devuelve una promesa.
async function flushRawEdits() {
  if (!rawMode || !rawEditorEl || !currentPath) return;
  const val = rawEditorEl.value;
  if (val === currentContent) return;
  setSaveStatus('saving');
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath, content: val })
    });
    const data = await res.json();
    if (res.ok) { currentContent = val; currentMtime = data.mtime; setSaveStatus('saved'); }
    else { setSaveStatus('error'); }
  } catch {
    setSaveStatus('error');
  }
}

function setSaveStatus(state) {
  const el = $('#save-status');
  if (!el) return;
  const map = {
    hidden: ['', ''],
    clean: ['', ''],
    dirty: ['save-dirty', '<i class="bi bi-pencil-fill"></i> sin guardar'],
    saving: ['save-dirty', '<i class="bi bi-arrow-repeat"></i> guardando…'],
    saved: ['save-ok', '<i class="bi bi-check-circle-fill"></i> guardado'],
    error: ['save-err', '<i class="bi bi-exclamation-triangle-fill"></i> error al guardar']
  };
  const [cls, html] = map[state] || map.hidden;
  el.className = 'save-status ' + cls;
  el.innerHTML = html;
  el.classList.toggle('hidden', !html);
}

function showOpenTab(show) {
  const b = $('#open-tab-btn');
  if (show) { b.href = mockUrl(currentPath); b.classList.remove('hidden'); }
  else b.classList.add('hidden');
}

function showOpenTab(show) {
  const b = $('#open-tab-btn');
  if (show) { b.href = mockUrl(currentPath); b.classList.remove('hidden'); }
  else b.classList.add('hidden');
}

function updateRawButton() {
  const b = $('#raw-btn');
  b.innerHTML = rawMode ? '<i class="bi bi-file-richtext"></i>' : '<i class="bi bi-code-slash"></i>';
  b.title = rawMode ? 'Ver formateado' : 'Ver original (raw)';
  b.classList.toggle('active-toggle', rawMode);
}

function updateBreadcrumb(path) {
  const parts = path.split('/');
  const file = parts.pop();
  breadcrumbEl.innerHTML = parts.map((p) => `<span>${p}</span>`).join(' / ') +
    (parts.length ? ' / ' : '') + `<span class="crumb-file">${file}</span>`;
}

function formatMeta(content, mtime) {
  const words = (content.match(/\S+/g) || []).length;
  const mins = Math.max(1, Math.round(words / 200));
  let date = '';
  if (mtime) {
    const d = new Date(mtime);
    date = ' · ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return `${words.toLocaleString()} palabras · ${mins} min${date}`;
}

/* ============================ Wire up UI ============================ */
function initUI() {
  // Sidebar collapse
  $('#collapse-btn').addEventListener('click', () => {
    $('#sidebar').classList.add('collapsed');
    $('#expand-btn').classList.remove('hidden');
  });
  $('#expand-btn').addEventListener('click', () => {
    $('#sidebar').classList.remove('collapsed');
    $('#expand-btn').classList.add('hidden');
  });

  // Search + modo (archivos / carpetas)
  $('#search').addEventListener('input', (e) => filterTree(e.target.value));
  $('#mode-files').addEventListener('click', () => setSearchMode('files'));
  $('#mode-folders').addEventListener('click', () => setSearchMode('folders'));

  // Root selector
  $('#root-go').addEventListener('click', () => changeRoot($('#root-input').value));
  $('#root-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') changeRoot($('#root-input').value);
  });
  $('#root-default').addEventListener('click', () => {
    if (defaultRoot) { $('#root-input').value = defaultRoot; changeRoot(defaultRoot); }
  });

  // Theme quick-toggle (full fine-tuning vive en /settings.html)
  $('#theme-btn').addEventListener('click', () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    const preset = MDConfig.PRESETS[next === 'dark' ? 'night' : 'default'];
    Object.assign(settings, preset, { theme: next });
    MDConfig.apply(settings); MDConfig.save(settings);
    if (currentPath && currentKind === 'md') renderCurrent(); // re-render mermaid
  });

  // TOC toggle
  $('#toc-btn').addEventListener('click', () => {
    const btn = $('#toc-btn');
    const off = btn.dataset.on === 'off';
    btn.dataset.on = off ? 'on' : 'off';
    if (off && tocLinks.length) tocEl.classList.remove('hidden');
    else tocEl.classList.add('hidden');
  });

  // Raw / formateado (con autosave al volver a formateado)
  $('#raw-btn').addEventListener('click', async () => {
    if (rawMode) await flushRawEdits(); // estamos saliendo del editor → guardar
    rawMode = !rawMode;
    localStorage.setItem('md-reader-raw', rawMode ? '1' : '0');
    if (currentPath) await renderCurrent();
    else updateRawButton();
  });

  // Red de seguridad: guardar ediciones pendientes al cerrar/recargar.
  window.addEventListener('beforeunload', () => {
    if (rawMode && rawEditorEl && currentPath && rawEditorEl.value !== currentContent) {
      const blob = new Blob(
        [JSON.stringify({ path: currentPath, content: rawEditorEl.value })],
        { type: 'application/json' }
      );
      navigator.sendBeacon('/api/save', blob);
    }
  });

  // Print
  $('#print-btn').addEventListener('click', () => window.print());

  // Settings ahora es una página aparte
  $('#settings-btn').addEventListener('click', () => { window.location.href = 'settings.html'; });

  // Active TOC tracking
  $('#content-wrap').addEventListener('scroll', throttle(updateActiveTOC, 120));

  // Keyboard: Ctrl/Cmd+K focuses search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); $('#search').focus();
    }
  });

  // Si cambian los settings en la pestaña de configuración, reflejarlos en vivo.
  // Los mocks HTML viven en un iframe propio: no se re-renderizan.
  window.addEventListener('storage', (e) => {
    if (e.key === MDConfig.STORAGE_KEY) {
      settings = MDConfig.load();
      MDConfig.apply(settings);
      if (currentPath && currentKind === 'md') renderCurrent();
    }
  });
}

function throttle(fn, ms) {
  let last = 0, timer = null;
  return function (...args) {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn.apply(this, args); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, ms); }
  };
}

/* ============================ Boot ============================ */
async function boot() {
  MDCore.configureMarked();
  MDConfig.apply(settings);
  initUI();
  await loadTree();

  if (location.hash.length > 1) {
    openFile(decodeURIComponent(location.hash.slice(1)));
  }
}

boot();
