// Panel web (admin-web/index.html): todo lo que viene del servidor y se mete
// en el HTML pasa por escapeHtml. Un recurso de Explorar con un `platform` o
// un `image_url` malicioso no debe poder ejecutar código en la sesión de un
// administrador.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'admin-web', 'index.html'), 'utf8');

/** Saca una función del <script> del panel y la evalúa aparte. */
function extract(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `no existe ${name}`);
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`no se pudo leer ${name}`);
}

const ctx = vm.createContext({});
vm.runInContext(`${extract('escapeHtml')}\n${extract('safeImageUrl')}`, ctx);

test('escapeHtml escapa también comillas (para atributos)', () => {
  assert.equal(ctx.escapeHtml('"><img src=x onerror=alert(1)>'), '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(ctx.escapeHtml("a'b&c"), 'a&#39;b&amp;c');
  assert.equal(ctx.escapeHtml(null), '');
});

test('safeImageUrl solo deja pasar http(s), y escapado', () => {
  assert.equal(ctx.safeImageUrl('javascript:alert(1)'), '');
  assert.equal(ctx.safeImageUrl('data:image/svg+xml,<svg onload=alert(1)>'), '');
  assert.equal(ctx.safeImageUrl('https://x.co/a.png" onerror="alert(1)'), 'https://x.co/a.png&quot; onerror=&quot;alert(1)');
});

test('la pestaña Explorar escapa platform, category, image_url y los errores', () => {
  const body = extract('loadExplore');
  for (const raw of ['${r.platform}', '${r.category}', '${r.image_url}', '${e.message}', '|| r.category}']) {
    assert.ok(!body.includes(raw), `loadExplore inserta ${raw} sin escapar`);
  }
  assert.match(body, /escapeHtml\(r\.platform\)/);
  assert.match(body, /safeImageUrl\(r\.image_url\)/);
  assert.match(body, /escapeHtml\(e\.message\)/);
  // Ningún error del panel se inserta en el HTML sin escapar.
  assert.ok(!/innerHTML = `[^`]*\$\{e\.message\}/.test(html), 'hay un e.message sin escapar en innerHTML');
});
