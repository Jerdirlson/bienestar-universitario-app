// Variante de static-pages.test.mjs con APK_URL definida. En un archivo
// aparte porque config.js la lee una sola vez al importar el módulo (arriba
// de este archivo) y node --test corre cada archivo en su propio proceso, así
// que no interfiere con el caso "sin APK_URL".
//
//   cd api && node --test tests/static-pages-apk.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://nadie:nada@127.0.0.1:1/nada';
process.env.JWT_SECRET ??= 'solo-para-pruebas-de-paginas-estaticas';
// Sin dígitos a propósito: la prueba de "ningún número salvo 106 y 123" no
// debe fallar por culpa del propio enlace de prueba.
process.env.APK_URL = 'https://cdn.example.com/raiz-app.apk';

const { app } = await import('../src/server.js');

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

test('/descargar con APK_URL ofrece el botón y el enlace en texto', async () => {
  const res = await fetch(`${base}/descargar`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');

  const body = await res.text();
  assert.match(body, /<a class="btn" href="https:\/\/cdn\.example\.com\/raiz-app\.apk">Descargar para Android<\/a>/);
  assert.doesNotMatch(body, /Descarga disponible pronto/);
  // El enlace también en texto grande, para quien prefiera copiarlo a mano.
  assert.match(body, /cdn\.example\.com\/raiz-app\.apk/);
});

test('/descargar con APK_URL sigue sin mencionar otro número que 106 y 123', async () => {
  const res = await fetch(`${base}/descargar`);
  const body = await res.text();
  const visible = body
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  const numbers = visible.match(/\d{2,}/g) || [];
  for (const n of numbers) {
    assert.ok(n === '106' || n === '123', `número inesperado en /descargar: "${n}"`);
  }
});
