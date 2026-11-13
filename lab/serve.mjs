// Minimal static server that mimics Vercel cleanUrls + trailingSlash:false + custom 404.html
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(process.argv[2] || '.'); const port = +process.argv[3] || 4173;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.mp4':'video/mp4', '.xml':'application/xml', '.txt':'text/plain', '.ico':'image/x-icon', '.woff2':'font/woff2' };
const send = (res, code, file) => { res.writeHead(code, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(file).pipe(res); };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/_vercel/')) { res.writeHead(204); return res.end(); }
  if (p.endsWith('.html')) { res.writeHead(308, { location: p.slice(0, -5) || '/' }); return res.end(); }
  if (p.length > 1 && p.endsWith('/')) { res.writeHead(308, { location: p.slice(0, -1) }); return res.end(); }
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  for (const c of [f, f + '.html', path.join(f, 'index.html')]) { try { if (fs.statSync(c).isFile()) return send(res, 200, c); } catch {} }
  send(res, 404, path.join(root, '404.html'));
}).listen(port, () => console.log('serving', root, 'on http://localhost:' + port));
