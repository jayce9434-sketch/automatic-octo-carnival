import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const chat = require('./chat.js');
const mime = { '.html':'text/html;charset=utf-8', '.js':'text/javascript;charset=utf-8', '.css':'text/css;charset=utf-8', '.json':'application/json;charset=utf-8' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/chat') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    return chat(req, res);
  }
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  file = path.normalize(path.join(root, file));
  if (!file.startsWith(root)) { res.statusCode = 403; res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    res.statusCode = 200;
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(3000, () => console.log('http://localhost:3000'));
