#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

// --- CLI parsing -----------------------------------------------------------
// Usage: node server.js [root] [--port N] [--no-open]
const argv = process.argv.slice(2);
let cliRoot = null;
let cliPort = null;
let noOpen = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--no-open' || a === '-n') noOpen = true;
  else if (a === '--port' || a === '-p') cliPort = Number(argv[++i]);
  else if (a.startsWith('--port=')) cliPort = Number(a.slice(7));
  else if (!a.startsWith('-')) cliRoot = a; // first positional = root
}

const PORT = cliPort || Number(process.env.MD_PORT) || 4321;
const NO_OPEN = noOpen || process.env.MD_NO_OPEN === '1';
const PUBLIC = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DEFAULT_ROOT = path.resolve(path.join(__dirname, '..'));

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch {}
}

// Root to scan for markdown files. Priority:
//   1. explicit CLI arg / MD_ROOT env var (always wins, not persisted)
//   2. last root chosen from the UI (config.json)
//   3. the parent folder of this app
// The root is mutable at runtime via POST /api/root.
const explicitRoot = cliRoot || process.env.MD_ROOT || null;
let currentRoot = path.resolve(explicitRoot || loadConfig().root || DEFAULT_ROOT);
if (!isDir(currentRoot)) currentRoot = DEFAULT_ROOT;

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
  '.txt': 'text/plain; charset=utf-8'
};

// Extensiones soportadas en el árbol y su "kind" para el ícono del cliente.
function fileKind(name) {
  if (/\.(md|markdown|mdx)$/i.test(name)) return 'md';
  if (/\.(html?|htm)$/i.test(name)) return 'html';
  return null;
}

// Recursively build a tree of folders containing supported files (md + html).
function buildTree(dir, depth) {
  if (depth > 12) return null;
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
      const sub = buildTree(full, depth + 1);
      if (sub && sub.children.length) children.push(sub);
    } else if (ent.isFile()) {
      const kind = fileKind(name);
      if (!kind) continue;
      let size = 0, mtime = 0;
      try { const st = fs.statSync(full); size = st.size; mtime = st.mtimeMs; } catch {}
      children.push({
        type: 'file',
        kind,
        name,
        path: path.relative(currentRoot, full).split(path.sep).join('/'),
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
    path: path.relative(currentRoot, dir).split(path.sep).join('/'),
    children
  };
}

// Resolve a client-supplied relative path safely inside the current root.
function safeResolve(relPath) {
  const target = path.resolve(currentRoot, relPath);
  const rootWithSep = currentRoot.endsWith(path.sep) ? currentRoot : currentRoot + path.sep;
  if (target !== currentRoot && !target.startsWith(rootWithSep)) return null;
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

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // API: get / set the scan root
  if (pathname === '/api/root') {
    if (req.method === 'POST') {
      const body = await readBody(req);
      const requested = String(body.path || '').trim();
      if (!requested) return sendJSON(res, 400, { error: 'Indicá una ruta.' });
      const resolved = path.resolve(requested);
      if (!isDir(resolved)) {
        return sendJSON(res, 400, { error: `La carpeta no existe o no es accesible:\n${resolved}` });
      }
      currentRoot = resolved;
      saveConfig({ ...loadConfig(), root: currentRoot });
      console.log(`  ↳ Root cambiado a: ${currentRoot}`);
      return sendJSON(res, 200, { root: currentRoot, default: DEFAULT_ROOT });
    }
    return sendJSON(res, 200, { root: currentRoot, default: DEFAULT_ROOT });
  }

  // API: file tree
  if (pathname === '/api/tree') {
    const tree = buildTree(currentRoot, 0) || { type: 'dir', name: currentRoot, path: '', children: [] };
    return sendJSON(res, 200, { root: currentRoot, default: DEFAULT_ROOT, tree });
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
    const target = safeResolve(rel);
    if (!target) return sendJSON(res, 400, { error: 'Invalid path' });
    if (!/\.(md|markdown|mdx)$/i.test(target)) return sendJSON(res, 400, { error: 'Not a markdown file' });
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
    const target = safeResolve(rel);
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

  // API: serve a raw asset (e.g. images) referenced relative to ROOT
  if (pathname === '/api/raw') {
    const rel = parsed.query.path || '';
    const target = safeResolve(rel);
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
  serveStatic(res, fileOnDisk);
});

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

server.listen(PORT, () => {
  const link = `http://localhost:${PORT}`;
  console.log('\n  📖  Markdown Reader');
  console.log('  ──────────────────────────────────────────');
  console.log(`  Sirviendo .md desde:  ${currentRoot}`);
  console.log(`  Abierto en:           ${link}`);
  console.log('  (Ctrl+C para detener)\n');
  if (!NO_OPEN) openBrowser(link);
});

// Si el puerto está ocupado, avisar con claridad en vez de un stack trace.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ⚠️  El puerto ${PORT} ya está en uso.`);
    console.error(`     Probá otro:  node server.js --port ${PORT + 1}\n`);
    process.exit(1);
  }
  throw err;
});
