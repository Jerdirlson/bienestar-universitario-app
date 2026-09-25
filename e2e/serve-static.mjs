// Servidor estático mínimo para el export web de Expo, con fallback de SPA:
// cualquier ruta que no sea un archivo real responde con index.html (la
// navegación de React Navigation en web es del lado del cliente). Se usa en
// vez de `expo start --web` porque es más rápido y determinista para e2e:
// una sola compilación, sin recarga en caliente ni watchers de más.
//
//   node serve-static.mjs <carpeta> <puerto>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [, , dir, portArg] = process.argv;
if (!dir) { console.error('uso: node serve-static.mjs <carpeta> <puerto>'); process.exit(1); }
const PORT = Number(portArg || 8081);
const ROOT = path.resolve(dir);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return send(filePath, res);
    // No es un archivo real: SPA fallback a index.html.
    send(path.join(ROOT, 'index.html'), res);
  });
}).listen(PORT, () => {
  console.log(`sirviendo ${ROOT} en http://localhost:${PORT}`);
});

function send(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
  });
}
