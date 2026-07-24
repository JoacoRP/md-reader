#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

// Frontend compilado por Vite (web/dist). En desarrollo, el server sólo expone
// /api y /mock; la UI la sirve Vite (vite dev) y proxea esas rutas acá.
const PUBLIC = path.join(__dirname, 'web', 'dist');
const DEFAULT_ROOT = path.resolve(path.join(__dirname, '..'));

// --- Estado a nivel de módulo (un solo server por proceso) ------------------
let CONFIG_FILE = path.join(__dirname, 'config.json'); // se puede reubicar vía startServer({configDir})
let currentRoot = DEFAULT_ROOT;     // raíz del lector (mutable vía POST /api/root)
let notesRoot = DEFAULT_ROOT;        // raíz de Note Taker (carpeta de notas, vía Settings)
let reportedDefault = DEFAULT_ROOT;  // lo que el botón "⟲ Default" del cliente usa

// Raíz activa según la sub-app que hace el request.
function rootFor(app) { return app === 'notes' ? notesRoot : currentRoot; }

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch {}
}

// Lee un .env simple (KEY=value o KEY:'value'). Sin dependencias.
function loadEnvFile() {
  const out = {};
  try {
    const txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(.*)$/);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return out;
}
function isTruthy(v) { return /^(true|1|yes|on)$/i.test(String(v || '').trim()); }

// Plantillas sembradas la primera vez en <carpeta de notas>/templates/.
const SEED_DAILY = `# Daily {{date}}

**Líderes de reunión:**
-

## Mío
**Done:**
-

**Todo:**
-

**Dudas/Consultas:**
-

## Orden ({{time}})
-

## Ausencias
-

## Notas
-
`;
const SEED_MEETING = `# Reunión — {{date}}

**Fecha:** {{date}}
**Hora:** {{time}}
**Lugar / Canal:**

## Participantes
-

## Temas
-

## Decisiones
-

## Acciones
- [ ] Acción — responsable — fecha límite
`;

// Asegura la carpeta de plantillas y siembra las built-in la primera vez.
// Devuelve la ruta de la carpeta de templates.
function ensureTemplatesDir(root) {
  const dir = path.join(root, 'templates');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      try { fs.writeFileSync(path.join(dir, 'Daily.md'), SEED_DAILY, { flag: 'wx', encoding: 'utf8' }); } catch {}
      try { fs.writeFileSync(path.join(dir, 'Reunión.md'), SEED_MEETING, { flag: 'wx', encoding: 'utf8' }); } catch {}
    }
  } catch {}
  return dir;
}

// Andamiaje de la carpeta de notas: crea Dailys/, Reuniones/ y templates/ si
// faltan. Se corre cada vez que se define la raíz de Note Taker (arranque y
// cambio por Settings) para que los destinos de creación existan siempre.
// Las subcarpetas deben coincidir con templateTargetDir() del cliente.
function ensureNotesScaffold(root) {
  if (!root || !isDir(root)) return;
  for (const sub of ['Dailys', 'Reuniones']) {
    try {
      const d = path.join(root, sub);
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    } catch {}
  }
  ensureTemplatesDir(root);
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build', 'bin', 'obj',
  '.next', '.nuxt', '.cache', 'coverage', '.vs', '.idea', '.angular',
  'packages', '.yarn', 'vendor'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  // Piper (modo lector, voz neuronal): el motor WASM necesita application/wasm
  // para instanciar por streaming; el modelo .onnx y el .data de espeak van como
  // octet-stream (se leen como ArrayBuffer, el MIME no importa).
  '.wasm': 'application/wasm'
};

// Extensiones soportadas en el árbol y su "kind" para el ícono del cliente.
function fileKind(name) {
  if (/\.(md|markdown|mdx)$/i.test(name)) return 'md';
  if (/\.(html?|htm)$/i.test(name)) return 'html';
  if (/\.txt$/i.test(name)) return 'txt';
  return null;
}

// Recursively build a tree of folders containing supported files.
// includeTxt: los .txt solo se indexan en la app Note Taker.
function buildTree(dir, depth, includeTxt, root) {
  if (depth > 12) return null;
  root = root || currentRoot;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const children = [];
  for (const ent of entries) {
    const name = ent.name;
    if (name.startsWith('.') && name !== '.github') continue;
    const full = path.join(dir, name);

    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(name.toLowerCase())) continue;
      const sub = buildTree(full, depth + 1, includeTxt, root);
      if (sub && sub.children.length) children.push(sub);
    } else if (ent.isFile()) {
      const kind = fileKind(name);
      if (!kind) continue;
      if (kind === 'txt' && !includeTxt) continue; // .txt solo en Note Taker
      let size = 0, mtime = 0;
      try { const st = fs.statSync(full); size = st.size; mtime = st.mtimeMs; } catch {}
      children.push({
        type: 'file',
        kind,
        name,
        path: path.relative(root, full).split(path.sep).join('/'),
        size,
        mtime
      });
    }
  }

  // Folders first, then files; both alphabetical.
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  return {
    type: 'dir',
    name: path.basename(dir) || dir,
    path: path.relative(root, dir).split(path.sep).join('/'),
    children
  };
}

// Resolve a client-supplied relative path safely inside the given root.
function safeResolve(relPath, root = currentRoot) {
  const target = path.resolve(root, relPath);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(rootWithSep)) return null;
  return target;
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Read and JSON-parse a request body (small payloads only).
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // API: get / set the scan root. body.which === 'notes' apunta a la carpeta de notas.
  if (pathname === '/api/root') {
    if (req.method === 'POST') {
      const body = await readBody(req);
      const requested = String(body.path || '').trim();
      if (!requested) return sendJSON(res, 400, { error: 'Indicá una ruta.' });
      const resolved = path.resolve(requested);
      if (!isDir(resolved)) {
        return sendJSON(res, 400, { error: `La carpeta no existe o no es accesible:\n${resolved}` });
      }
      if (body.which === 'notes') {
        notesRoot = resolved;
        ensureNotesScaffold(notesRoot); // crea Dailys/Reuniones/templates si faltan
        console.log(`  ↳ Carpeta de notas cambiada a: ${notesRoot}`);
      } else {
        currentRoot = resolved;
        console.log(`  ↳ Root cambiado a: ${currentRoot}`);
      }
      saveConfig({ ...loadConfig(), root: currentRoot, notesRoot });
      return sendJSON(res, 200, { root: currentRoot, notesRoot, default: reportedDefault });
    }
    return sendJSON(res, 200, { root: currentRoot, notesRoot, default: reportedDefault });
  }

  // API: file tree (resuelto contra la raíz de la sub-app que pide)
  if (pathname === '/api/tree') {
    const app = parsed.query.app;
    const root = rootFor(app);
    const tree = buildTree(root, 0, app === 'notes', root) || { type: 'dir', name: root, path: '', children: [] };
    return sendJSON(res, 200, { root, default: reportedDefault, tree });
  }

  // API: lista las plantillas (.md en <raíz>/templates/). Siembra las built-in la 1ª vez.
  if (pathname === '/api/templates') {
    const root = rootFor(parsed.query.app);
    const dir = ensureTemplatesDir(root);
    let templates = [];
    try {
      templates = fs.readdirSync(dir)
        .filter((n) => /\.(md|markdown|mdx)$/i.test(n))
        .map((n) => ({ name: n.replace(/\.[^.]+$/, ''), file: n }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    } catch {}
    return sendJSON(res, 200, { templates });
  }

  // Mocks HTML "con esteroides": se sirven bajo /mock/<ruta> para que sus
  // links y assets relativos resuelvan correctamente (se cargan en un iframe).
  if (pathname.startsWith('/mock/')) {
    const rel = pathname.slice('/mock/'.length);
    const target = safeResolve(rel);
    if (!target) { res.writeHead(400); return res.end('Invalid path'); }
    return serveStatic(res, target);
  }

  // API: raw markdown content
  if (pathname === '/api/file') {
    const rel = parsed.query.path || '';
    const target = safeResolve(rel, rootFor(parsed.query.app));
    if (!target) return sendJSON(res, 400, { error: 'Invalid path' });
    if (!/\.(md|markdown|mdx|txt)$/i.test(target)) return sendJSON(res, 400, { error: 'Tipo de archivo no legible' });
    fs.readFile(target, 'utf8', (err, content) => {
      if (err) return sendJSON(res, 404, { error: 'File not found' });
      let mtime = 0;
      try { mtime = fs.statSync(target).mtimeMs; } catch {}
      sendJSON(res, 200, { path: rel, content, mtime });
    });
    return;
  }

  // API: save edited content back to a file (markdown o html).
  if (pathname === '/api/save' && req.method === 'POST') {
    const body = await readBody(req);
    const rel = String(body.path || '');
    const target = safeResolve(rel, rootFor(body.app));
    if (!target) return sendJSON(res, 400, { error: 'Invalid path' });
    if (!fileKind(path.basename(target))) {
      return sendJSON(res, 400, { error: 'Tipo de archivo no editable' });
    }
    if (typeof body.content !== 'string') {
      return sendJSON(res, 400, { error: 'Contenido inválido' });
    }
    try {
      fs.writeFileSync(target, body.content, 'utf8');
      const mtime = fs.statSync(target).mtimeMs;
      return sendJSON(res, 200, { path: rel, mtime });
    } catch (err) {
      return sendJSON(res, 500, { error: 'No se pudo guardar: ' + err.message });
    }
  }

  // API: create a new file (nota). Body: { dir, name, content, app }
  if (pathname === '/api/create' && req.method === 'POST') {
    const body = await readBody(req);
    const root = rootFor(body.app);
    let name = String(body.name || '').trim();
    const dir = String(body.dir || '').trim();
    if (!name) return sendJSON(res, 400, { error: 'Indicá un nombre.' });
    if (/[\\/:*?"<>|]/.test(name) || name.includes('..')) {
      return sendJSON(res, 400, { error: 'El nombre tiene caracteres inválidos.' });
    }
    if (!fileKind(name)) name += '.md';              // por defecto, nota Markdown
    if (!fileKind(name)) return sendJSON(res, 400, { error: 'Extensión no soportada.' });
    const target = safeResolve(path.join(dir, name), root);
    if (!target || !safeResolve(dir || '.', root)) return sendJSON(res, 400, { error: 'Ruta inválida.' });
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const content = typeof body.content === 'string' ? body.content : '';
      fs.writeFileSync(target, content, { flag: 'wx', encoding: 'utf8' });
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Ya existe: en vez de duplicar, devolvemos el archivo existente para abrirlo.
        const relEx = path.relative(root, target).split(path.sep).join('/');
        let mtimeEx = 0; try { mtimeEx = fs.statSync(target).mtimeMs; } catch {}
        return sendJSON(res, 200, { path: relEx, kind: fileKind(name), mtime: mtimeEx, existed: true });
      }
      return sendJSON(res, 500, { error: 'No se pudo crear: ' + err.message });
    }
    const rel = path.relative(root, target).split(path.sep).join('/');
    let mtime = 0; try { mtime = fs.statSync(target).mtimeMs; } catch {}
    return sendJSON(res, 200, { path: rel, kind: fileKind(name), mtime });
  }

  // API: rename a file in place. Body: { path, newName, app }
  if (pathname === '/api/rename' && req.method === 'POST') {
    const body = await readBody(req);
    const root = rootFor(body.app);
    const rel = String(body.path || '');
    let newName = String(body.newName || '').trim();
    const oldTarget = safeResolve(rel, root);
    if (!oldTarget || !rel) return sendJSON(res, 400, { error: 'Ruta inválida.' });
    if (!newName) return sendJSON(res, 400, { error: 'Indicá un nombre.' });
    if (/[\\/:*?"<>|]/.test(newName) || newName.includes('..')) {
      return sendJSON(res, 400, { error: 'El nombre tiene caracteres inválidos.' });
    }
    if (!fileKind(newName)) newName += path.extname(rel); // conservar extensión original
    if (!fileKind(newName)) return sendJSON(res, 400, { error: 'Extensión no soportada.' });
    const dirPosix = rel.split('/').slice(0, -1).join('/');
    const newRel = (dirPosix ? dirPosix + '/' : '') + newName;
    const newTarget = safeResolve(newRel, root);
    if (!newTarget) return sendJSON(res, 400, { error: 'Ruta inválida.' });
    if (fs.existsSync(newTarget)) return sendJSON(res, 409, { error: 'Ya existe un archivo con ese nombre.' });
    try {
      fs.renameSync(oldTarget, newTarget);
    } catch (err) {
      return sendJSON(res, 500, { error: 'No se pudo renombrar: ' + err.message });
    }
    let mtime = 0; try { mtime = fs.statSync(newTarget).mtimeMs; } catch {}
    return sendJSON(res, 200, { path: newRel, kind: fileKind(newName), mtime });
  }

  // API: delete a file. Body: { path, app }
  if (pathname === '/api/delete' && req.method === 'POST') {
    const body = await readBody(req);
    const root = rootFor(body.app);
    const rel = String(body.path || '');
    const target = safeResolve(rel, root);
    if (!target || !rel) return sendJSON(res, 400, { error: 'Ruta inválida.' });
    if (!fileKind(path.basename(target))) return sendJSON(res, 400, { error: 'Tipo de archivo no permitido.' });
    try {
      if (!fs.statSync(target).isFile()) return sendJSON(res, 400, { error: 'No es un archivo.' });
      fs.unlinkSync(target);
    } catch (err) {
      if (err.code === 'ENOENT') return sendJSON(res, 404, { error: 'El archivo no existe.' });
      return sendJSON(res, 500, { error: 'No se pudo eliminar: ' + err.message });
    }
    return sendJSON(res, 200, { ok: true });
  }

  // API: serve a raw asset (e.g. images) referenced relative to ROOT
  if (pathname === '/api/raw') {
    const rel = parsed.query.path || '';
    const target = safeResolve(rel, rootFor(parsed.query.app));
    if (!target) { res.writeHead(400); return res.end('Invalid path'); }
    return serveStatic(res, target);
  }

  // Static frontend
  let staticPath = pathname === '/' ? '/index.html' : pathname;
  staticPath = staticPath.replace(/^\/+/, '');
  const fileOnDisk = path.join(PUBLIC, staticPath);
  // Prevent escaping the public dir.
  if (!fileOnDisk.startsWith(PUBLIC)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  // SPA fallback: rutas sin extensión (p.ej. /settings) las maneja el router
  // de React → servimos index.html y dejamos que el cliente resuelva la ruta.
  if (!path.extname(fileOnDisk)) {
    return serveStatic(res, path.join(PUBLIC, 'index.html'));
  }
  serveStatic(res, fileOnDisk);
}

// Cross-platform "open this URL in the default browser".
function openBrowser(target) {
  try {
    if (process.platform === 'win32') {
      // `start` is a cmd builtin; "" is the (empty) window title argument.
      spawn('cmd', ['/c', 'start', '""', target], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [target], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch { /* abrir el browser es best-effort */ }
}

/**
 * Arranca el servidor HTTP. Devuelve una promesa con { server, port, root }.
 * Opciones:
 *   root        ruta inicial explícita (gana sobre config.json)
 *   port        puerto (0 = el SO asigna uno libre). Default 4321.
 *   open        abrir el browser por defecto al arrancar (default true)
 *   configDir   carpeta donde guardar/leer config.json (default: junto a server.js)
 *   defaultRoot raíz por defecto si no hay explícita ni guardada, y lo que
 *               reporta el server como "default" al cliente (default: carpeta padre)
 */
function startServer(opts = {}) {
  const port = opts.port != null ? opts.port : 4321;
  const open = opts.open !== false;
  const defaultRoot = opts.defaultRoot ? path.resolve(opts.defaultRoot) : DEFAULT_ROOT;
  reportedDefault = defaultRoot;
  if (opts.configDir) CONFIG_FILE = path.join(opts.configDir, 'config.json');

  // .env: si PERSONAL_ENV es truthy, sus rutas SIEMBRAN las raíces (semilla
  // inicial). El cache real es config.json: una vez que el usuario cambia la
  // carpeta desde Settings, ese valor manda y el .env deja de pisarlo en cada
  // reinicio. Así las rutas se modifican sólo por Settings y persisten.
  const env = loadEnvFile();
  const personal = isTruthy(env.PERSONAL_ENV);
  const envMR = personal ? env.MR_ROOT_PATH : '';
  const envNT = personal ? env.NT_ROOT_PATH : '';
  const cfg = loadConfig();

  // Raíz del lector. Prioridad: CLI > config.json (cache) > .env (semilla) > default.
  let root = path.resolve(opts.root || cfg.root || envMR || defaultRoot);
  if (!isDir(root)) root = isDir(defaultRoot) ? defaultRoot : DEFAULT_ROOT;
  currentRoot = root;

  // Carpeta de notas (Note Taker). Prioridad: config.json (cache) > .env (semilla) > Documentos.
  // No se mezcla con la raíz del lector: si la ruta configurada no existe, se
  // avisa con claridad y se cae a la carpeta por defecto (no a currentRoot).
  const notesConfigured = cfg.notesRoot || envNT;
  const nRoot = path.resolve(notesConfigured || defaultRoot);
  if (isDir(nRoot)) {
    notesRoot = nRoot;
  } else {
    console.warn(`  ⚠️  Carpeta de notas inexistente: ${nRoot}`);
    console.warn(`      Usando ${defaultRoot}. Corregí NT_ROOT_PATH en .env o la carpeta en Settings.`);
    notesRoot = defaultRoot;
  }
  ensureNotesScaffold(notesRoot); // garantiza Dailys/Reuniones/templates en la raíz de notas

  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest);
    server.on('error', reject);
    // Bind sólo a loopback: la app es estrictamente local.
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      if (open) openBrowser(`http://127.0.0.1:${actualPort}`);
      resolve({ server, port: actualPort, root: currentRoot, notesRoot });
    });
  });
}

// --- CLI: `node server.js [root] [--port N] [--no-open]` ---------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  let cliRoot = null, cliPort = null, noOpen = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open' || a === '-n') noOpen = true;
    else if (a === '--port' || a === '-p') cliPort = Number(argv[++i]);
    else if (a.startsWith('--port=')) cliPort = Number(a.slice(7));
    else if (!a.startsWith('-')) cliRoot = a; // first positional = root
  }
  const port = cliPort || Number(process.env.MD_PORT) || 4321;
  startServer({
    root: cliRoot || process.env.MD_ROOT || null,
    port,
    open: !(noOpen || process.env.MD_NO_OPEN === '1')
  }).then(({ port, root, notesRoot }) => {
    console.log('\n  📖  Markdown Reader');
    console.log('  ──────────────────────────────────────────');
    console.log(`  Lector (.md/.html):   ${root}`);
    console.log(`  Note Taker (notas):   ${notesRoot}`);
    console.log(`  Abierto en:           http://127.0.0.1:${port}`);
    console.log('  (Ctrl+C para detener)\n');
  }).catch((err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  ⚠️  El puerto ${port} ya está en uso.`);
      console.error(`     Probá otro:  node server.js --port ${port + 1}\n`);
      process.exit(1);
    }
    throw err;
  });
}

module.exports = { startServer, DEFAULT_ROOT };
