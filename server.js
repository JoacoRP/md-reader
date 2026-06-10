#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Root to scan for markdown files. Defaults to C:\dev (parent of this app),
// override with `node server.js <root>` or the MD_ROOT env var.
const ROOT = path.resolve(process.argv[2] || process.env.MD_ROOT || path.join(__dirname, '..'));
const PORT = Number(process.env.MD_PORT) || 4321;
const PUBLIC = path.join(__dirname, 'public');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build', 'bin', 'obj',
  '.next', '.nuxt', '.cache', 'coverage', '.vs', '.idea', '.angular',
  'packages', '.yarn', 'vendor'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Recursively build a tree of folders containing markdown files.
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
    } else if (ent.isFile() && /\.(md|markdown|mdx)$/i.test(name)) {
      let size = 0, mtime = 0;
      try { const st = fs.statSync(full); size = st.size; mtime = st.mtimeMs; } catch {}
      children.push({
        type: 'file',
        name,
        path: path.relative(ROOT, full).split(path.sep).join('/'),
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
    path: path.relative(ROOT, dir).split(path.sep).join('/'),
    children
  };
}

// Resolve a client-supplied relative path safely inside ROOT.
function safeResolve(relPath) {
  const target = path.resolve(ROOT, relPath);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (target !== ROOT && !target.startsWith(rootWithSep)) return null;
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

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // API: file tree
  if (pathname === '/api/tree') {
    const tree = buildTree(ROOT, 0) || { type: 'dir', name: ROOT, path: '', children: [] };
    return sendJSON(res, 200, { root: ROOT, tree });
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

server.listen(PORT, () => {
  const link = `http://localhost:${PORT}`;
  console.log('\n  📖  Markdown Reader');
  console.log('  ──────────────────────────────────────────');
  console.log(`  Sirviendo .md desde:  ${ROOT}`);
  console.log(`  Abrí en el browser:   ${link}\n`);
});
