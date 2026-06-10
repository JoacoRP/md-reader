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

/* ============================ Settings ============================ */
const FONT_FAMILIES = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', Times, serif"
};

const DEFAULT_SETTINGS = {
  fontFamily: 'system',
  fontSize: 16,
  lineHeight: 1.7,
  contentWidth: 860,
  textColor: '#1f2328',
  bgColor: '#ffffff',
  accentColor: '#0969da',
  theme: 'light'
};

const PRESETS = {
  default: { textColor: '#1f2328', bgColor: '#ffffff', accentColor: '#0969da', theme: 'light' },
  sepia:   { textColor: '#433422', bgColor: '#f4ecd8', accentColor: '#9a5b2e', theme: 'light' },
  night:   { textColor: '#c9d1d9', bgColor: '#0d1117', accentColor: '#58a6ff', theme: 'dark' },
  contrast:{ textColor: '#000000', bgColor: '#ffffff', accentColor: '#0033cc', theme: 'light' }
};

let settings = loadSettings();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('md-reader-settings') || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem('md-reader-settings', JSON.stringify(settings));
}

function resolveFontFamily(v) {
  return FONT_FAMILIES[v] || v;
}

function applySettings() {
  const r = document.documentElement.style;
  r.setProperty('--md-font-family', resolveFontFamily(settings.fontFamily));
  r.setProperty('--md-font-size', settings.fontSize + 'px');
  r.setProperty('--md-line-height', settings.lineHeight);
  r.setProperty('--md-content-width', settings.contentWidth + 'px');
  r.setProperty('--md-text-color', settings.textColor);
  r.setProperty('--md-bg-color', settings.bgColor);
  r.setProperty('--md-accent-color', settings.accentColor);
  document.documentElement.setAttribute('data-theme', settings.theme);

  // hljs theme + mermaid theme follow light/dark
  $('#hljs-light').disabled = settings.theme === 'dark';
  $('#hljs-dark').disabled = settings.theme !== 'dark';
  $('#theme-btn').textContent = settings.theme === 'dark' ? '☀️' : '🌙';

  syncSettingsControls();
}

function syncSettingsControls() {
  $('#set-font-family').value = settings.fontFamily;
  $('#set-font-size').value = settings.fontSize;
  $('#fs-val').textContent = settings.fontSize + 'px';
  $('#set-line-height').value = settings.lineHeight;
  $('#lh-val').textContent = settings.lineHeight;
  $('#set-content-width').value = settings.contentWidth;
  $('#cw-val').textContent = settings.contentWidth + 'px';
  $('#set-text-color').value = settings.textColor;
  $('#set-bg-color').value = settings.bgColor;
  $('#set-accent-color').value = settings.accentColor;
}

/* ============================ Markdown rendering ============================ */
let mermaidCounter = 0;

function configureMarked() {
  const renderer = new marked.Renderer();

  // Capture mermaid code blocks; highlight the rest with hljs.
  renderer.code = function (code, infostring) {
    const lang = (infostring || '').trim().split(/\s+/)[0].toLowerCase();
    if (lang === 'mermaid') {
      const id = 'mermaid-' + (mermaidCounter++);
      const encoded = encodeURIComponent(code);
      return `<div class="mermaid-block" data-mermaid="${encoded}" id="${id}"></div>`;
    }
    let highlighted, used = lang;
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(code, { language: lang }).value;
      } else {
        const auto = hljs.highlightAuto(code);
        highlighted = auto.value; used = auto.language || '';
      }
    } catch {
      highlighted = escapeHtml(code);
    }
    return `<pre><button class="copy-code">Copiar</button><code class="hljs language-${used}">${highlighted}</code></pre>`;
  };

  // Slugged heading anchors for the TOC.
  renderer.heading = function (text, level) {
    const slug = slugify(stripTags(text));
    return `<h${level} id="${slug}">${text}` +
      `<a class="heading-anchor" href="#${slug}" aria-label="Enlace">#</a></h${level}>`;
  };

  marked.setOptions({ renderer, gfm: true, breaks: false, headerIds: false, mangle: false });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function stripTags(s) { return s.replace(/<[^>]*>/g, ''); }

const slugCounts = {};
function slugify(text) {
  let base = text.toLowerCase().trim()
    .replace(/[^\wÀ-ɏ\s-]/g, '')
    .replace(/\s+/g, '-');
  if (!base) base = 'section';
  if (slugCounts[base] != null) { slugCounts[base]++; base = base + '-' + slugCounts[base]; }
  else { slugCounts[base] = 0; }
  return base;
}

async function renderMarkdown(md) {
  // reset per-document state
  for (const k in slugCounts) delete slugCounts[k];
  mermaidCounter = 0;

  const rawHtml = marked.parse(md);
  const clean = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['foreignObject'],
    ADD_ATTR: ['data-mermaid', 'target']
  });
  contentEl.innerHTML = clean;

  enhanceContent();
  await renderMermaid();
  buildTOC();
  contentEl.parentElement.scrollTop = 0;
}

function enhanceContent() {
  // Copy-to-clipboard for code blocks
  contentEl.querySelectorAll('.copy-code').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.parentElement.querySelector('code');
      navigator.clipboard.writeText(code.innerText).then(() => {
        btn.textContent = '✓ Copiado';
        setTimeout(() => (btn.textContent = 'Copiar'), 1200);
      });
    });
  });

  // External links open in a new tab; internal anchors scroll smoothly.
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
      // Relative link to another markdown file → load it in-app.
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const resolved = resolveRelative(currentPath, href);
        loadFile(resolved);
      });
    }
  });

  // Rewrite relative <img> sources to be fetched through the server.
  contentEl.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!/^(https?:|data:|\/)/.test(src)) {
      const resolved = resolveRelative(currentPath, src);
      img.src = '/api/raw?path=' + encodeURIComponent(resolved);
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

async function renderMermaid() {
  const blocks = contentEl.querySelectorAll('.mermaid-block');
  if (!blocks.length) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: settings.theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'loose'
  });
  for (const block of blocks) {
    const code = decodeURIComponent(block.getAttribute('data-mermaid'));
    try {
      const { svg } = await mermaid.render(block.id + '-svg', code);
      block.innerHTML = svg;
    } catch (err) {
      block.classList.add('mermaid-error');
      block.textContent = 'Error en diagrama Mermaid:\n' + (err && err.message ? err.message : err);
    }
  }
}

/* ============================ Table of contents ============================ */
let tocLinks = [];

function buildTOC() {
  const headings = contentEl.querySelectorAll('h1, h2, h3, h4');
  if (headings.length < 2) { tocEl.classList.add('hidden'); tocLinks = []; return; }

  let html = '<div class="toc-title">Contenido</div>';
  headings.forEach((h) => {
    const lvl = Number(h.tagName[1]);
    html += `<a href="#${h.id}" class="lvl-${lvl}" data-target="${h.id}">${stripTags(h.innerHTML).replace('#', '')}</a>`;
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
  const wrap = $('#content-wrap');
  const scrollTop = wrap.scrollTop;
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
  // Render the root's children directly (skip showing the root node itself).
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
    location.hash = '';
    document.title = 'Markdown Reader';
    breadcrumbEl.textContent = '';
    fileMetaEl.textContent = '';
    tocEl.classList.add('hidden');
    contentEl.innerHTML = '<div class="empty-state"><h1>📂 Raíz actualizada</h1>' +
      `<p>Mostrando los <code>.md</code> bajo:</p><p class="hint">${data.root}</p>` +
      '<p class="hint">Elegí un archivo del panel izquierdo.</p></div>';
    $('#search').value = '';
    await loadTree();
  } catch {
    errEl.textContent = 'Error de conexión con el servidor.';
  }
}

function renderNode(node, depth) {
  if (node.type === 'file') {
    const div = document.createElement('div');
    div.className = 'tree-node tree-file';
    div.dataset.path = node.path;
    div.dataset.name = node.name.toLowerCase();
    const label = document.createElement('div');
    label.className = 'tree-label';
    label.innerHTML = `<span class="twisty"></span><span class="icon">📄</span><span class="name">${node.name}</span>`;
    label.addEventListener('click', () => loadFile(node.path));
    div.appendChild(label);
    return div;
  }

  const div = document.createElement('div');
  div.className = 'tree-node tree-dir';
  if (depth >= 1) div.classList.add('collapsed'); // top-level expanded, deeper collapsed
  const label = document.createElement('div');
  label.className = 'tree-label';
  label.innerHTML = `<span class="twisty">▶</span><span class="icon">📁</span><span class="name">${node.name}</span>`;
  label.addEventListener('click', () => {
    div.classList.toggle('collapsed');
    label.querySelector('.twisty').textContent = div.classList.contains('collapsed') ? '▶' : '▼';
  });
  if (!div.classList.contains('collapsed')) label.querySelector('.twisty').textContent = '▼';
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
    // expand ancestors
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
function filterTree(query) {
  const q = query.trim().toLowerCase();
  const files = treeEl.querySelectorAll('.tree-file');
  if (!q) {
    files.forEach((f) => f.classList.remove('hidden'));
    treeEl.querySelectorAll('.tree-dir').forEach((d) => { d.classList.remove('hidden'); });
    return;
  }
  files.forEach((f) => {
    const match = f.dataset.path.toLowerCase().includes(q);
    f.classList.toggle('hidden', !match);
  });
  // Hide empty dirs, expand matching ones.
  treeEl.querySelectorAll('.tree-dir').forEach((d) => {
    const visibleFiles = d.querySelectorAll('.tree-file:not(.hidden)').length;
    d.classList.toggle('hidden', visibleFiles === 0);
    if (visibleFiles > 0) {
      d.classList.remove('collapsed');
      const tw = d.querySelector(':scope > .tree-label .twisty');
      if (tw) tw.textContent = '▼';
    }
  });
}

/* ============================ Load a file ============================ */
async function loadFile(path) {
  if (!path) return;
  currentPath = path;
  try {
    const res = await fetch('/api/file?path=' + encodeURIComponent(path));
    if (!res.ok) throw new Error('No se pudo cargar el archivo');
    const data = await res.json();
    await renderMarkdown(data.content);
    updateBreadcrumb(path);
    fileMetaEl.textContent = formatMeta(data.content, data.mtime);
    setActiveInTree(path);
    document.title = path.split('/').pop() + ' — Markdown Reader';
    location.hash = encodeURIComponent(path);
  } catch (err) {
    contentEl.innerHTML = `<div class="mermaid-error">⚠️ ${err.message}</div>`;
  }
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

  // Search
  $('#search').addEventListener('input', (e) => filterTree(e.target.value));

  // Root selector
  $('#root-go').addEventListener('click', () => changeRoot($('#root-input').value));
  $('#root-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') changeRoot($('#root-input').value);
  });
  $('#root-default').addEventListener('click', () => {
    if (defaultRoot) { $('#root-input').value = defaultRoot; changeRoot(defaultRoot); }
  });

  // Theme toggle
  $('#theme-btn').addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    // Adjust document colors to sensible defaults when switching theme.
    if (settings.theme === 'dark' && settings.bgColor === '#ffffff') {
      settings.bgColor = '#0d1117'; settings.textColor = '#c9d1d9'; settings.accentColor = '#58a6ff';
    } else if (settings.theme === 'light' && settings.bgColor === '#0d1117') {
      settings.bgColor = '#ffffff'; settings.textColor = '#1f2328'; settings.accentColor = '#0969da';
    }
    applySettings(); saveSettings();
    if (currentPath) loadFile(currentPath); // re-render mermaid with new theme
  });

  // TOC toggle
  $('#toc-btn').addEventListener('click', () => {
    const btn = $('#toc-btn');
    const off = btn.dataset.on === 'off';
    btn.dataset.on = off ? 'on' : 'off';
    if (off && tocLinks.length) tocEl.classList.remove('hidden');
    else tocEl.classList.add('hidden');
  });

  // Print
  $('#print-btn').addEventListener('click', () => window.print());

  // Settings panel
  $('#settings-btn').addEventListener('click', () => $('#settings-panel').classList.toggle('hidden'));
  $('#settings-close').addEventListener('click', () => $('#settings-panel').classList.add('hidden'));

  const bind = (id, key, transform) => {
    $(id).addEventListener('input', (e) => {
      settings[key] = transform ? transform(e.target.value) : e.target.value;
      applySettings(); saveSettings();
    });
  };
  bind('#set-font-family', 'fontFamily');
  bind('#set-font-size', 'fontSize', Number);
  bind('#set-line-height', 'lineHeight', Number);
  bind('#set-content-width', 'contentWidth', Number);
  bind('#set-text-color', 'textColor');
  bind('#set-bg-color', 'bgColor');
  bind('#set-accent-color', 'accentColor');

  document.querySelectorAll('.settings-presets button').forEach((b) => {
    b.addEventListener('click', () => {
      Object.assign(settings, PRESETS[b.dataset.preset]);
      applySettings(); saveSettings();
      if (currentPath) loadFile(currentPath);
    });
  });

  $('#settings-reset').addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS };
    applySettings(); saveSettings();
    if (currentPath) loadFile(currentPath);
  });

  // Active TOC tracking
  $('#content-wrap').addEventListener('scroll', throttle(updateActiveTOC, 120));

  // Keyboard: Ctrl/Cmd+K focuses search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); $('#search').focus();
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
  configureMarked();
  applySettings();
  initUI();
  await loadTree();

  // Deep-link support: #<path>
  if (location.hash.length > 1) {
    const path = decodeURIComponent(location.hash.slice(1));
    loadFile(path);
  }
}

boot();
