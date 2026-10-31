import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL(process.argv.includes('--dist') ? '../dist/' : '../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405, {Allow: 'GET, HEAD'}).end();return;}
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://site.local').pathname);
    // Serve only public site files; never serve notebooks, Git data, or tests.
    const relative = pathname === '/' || pathname === '/index.html' ? 'index.html' : pathname.replace(/^\//, '');
    const publicFile = ['styles.css', 'app.js', 'gift.config.json', 'index.html'].includes(relative) || (relative.startsWith('assets/') && !relative.split('/').some(part => part.startsWith('.') || part === '..'));
    const file = path.resolve(root, relative);
    if (!publicFile || !file.startsWith(root + path.sep)) {res.writeHead(404).end('Not found');return;}
    const info = await stat(file);
    if (!info.isFile()) {res.writeHead(404).end('Not found');return;}
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    // Byte ranges allow seeking and playback of local MP3/M4A on mobile Safari.
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start, end;
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
        end = match[1] ? (match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1) : info.size - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {res.writeHead(416, {'Content-Range': `bytes */${info.size}`}).end();return;}
      res.writeHead(206, {...headers, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end-start+1});
      if (req.method === 'HEAD') res.end(); else createReadStream(file, {start, end}).pipe(res);
      return;
    }
    res.writeHead(200, {...headers, 'Content-Length': info.size, 'Accept-Ranges': 'bytes'});
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch {res.writeHead(404).end('Not found');}
});
server.on('error', error => {console.error(error.message); process.exitCode = 1;});
server.listen(port, host, () => console.log(`Birthday gift server started on port ${port} (${process.argv.includes('--dist') ? 'production build' : 'development'}).`));
