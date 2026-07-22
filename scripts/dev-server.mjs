#!/usr/bin/env node
/**
 * Local static server with clean URL maps matching nginx:
 *   /zk → pages/zk.html, /loyalty → pages/loyalty.html, etc.
 * Serves source tree (no rebuild required for HTML/CSS edits).
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8001);

const CLEAN = {
  '/': '/pages/index.html',
  '/zk': '/pages/zk.html',
  '/zk-digest': '/pages/zk.html', // retired draft → live desk
  '/loyalty': '/pages/loyalty.html',
  '/contact': '/pages/contact.html',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function resolveUrl(urlPath) {
  const bare = urlPath.split('?')[0].split('#')[0] || '/';
  if (CLEAN[bare]) return CLEAN[bare];
  if (bare.endsWith('.html') && bare.startsWith('/pages/')) return bare;
  return bare;
}

function safeJoin(urlPath) {
  const rel = resolveUrl(urlPath).replace(/^\/+/, '');
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url || '/');
  let filePath = safeJoin(urlPath);
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // directory index fallback
      if (!err && st.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${urlPath}`);
        return;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, () => {
  console.log(`permissionless.money dev → http://127.0.0.1:${port}`);
  console.log(`  zk desk: http://127.0.0.1:${port}/zk`);
});
