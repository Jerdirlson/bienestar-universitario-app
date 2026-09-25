// Pruebas de las páginas estáticas que sirve el API: el panel de
// administración (/panel) y la página de descarga (/descargar), sin
// APK_URL. La variante con APK_URL definida vive en
// static-pages-apk.test.mjs, en un proceso aparte -- config.js la lee una
// sola vez al importar el módulo, así que no se puede alternar dentro del
// mismo proceso.
//
// A propósito, sin base de datos: node --test corre cada archivo en su
// propio proceso, así que fijamos DATABASE_URL/JWT_SECRET con valores de
// mentira solo si nadie los puso ya (p. ej. al correr esto dentro de
// api/run-tests.sh, que sí levanta Postgres) -- el pool de Postgres se crea
// perezoso (api/src/db.js) y ninguna ruta de aquí lo toca.
//
//   cd api && node --test tests/static-pages.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://nadie:nada@127.0.0.1:1/nada';
process.env.JWT_SECRET ??= 'solo-para-pruebas-de-paginas-estaticas';

const { app } = await import('../src/server.js');

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

test('/panel devuelve el HTML del panel con las cabeceras de seguridad', async () => {
  const res = await fetch(`${base}/panel`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');

  const body = await res.text();
  assert.match(body, /Raíz · Administración/);
  // Debe usar el mismo origen por defecto, no la URL de túnel vieja
  // (dave-pressure-condition-conventional.trycloudflare.com) que quedó fija
  // en el HTML.
  assert.doesNotMatch(body, /trycloudflare/);
  assert.match(body, /location\.origin/);
});

test('/descargar sin APK_URL avisa "pronto" y no ofrece un botón roto', async () => {
  const res = await fetch(`${base}/descargar`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');

  const body = await res.text();
  assert.match(body, /Descarga disponible pronto/);
  assert.doesNotMatch(body, /Descargar para Android<\/a>/);
  // El resto del contenido honesto debe seguir ahí aunque no haya APK.
  assert.match(body, /Demo en pruebas/);
  assert.match(body, /iPhone/);
});

test('/descargar no menciona ningún número distinto de 106 y 123', async () => {
  const res = await fetch(`${base}/descargar`);
  const body = await res.text();
  // Quita <style>/<script> y luego todas las etiquetas: solo interesa lo que
  // de verdad se le muestra a la persona, no valores de CSS como "16px".
  const visible = body
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  const numbers = visible.match(/\d{2,}/g) || [];
  for (const n of numbers) {
    assert.ok(n === '106' || n === '123', `número inesperado en /descargar: "${n}"`);
  }
  // Y que sí estén los dos que corresponden (el recordatorio de crisis).
  assert.ok(numbers.includes('106'), 'falta la Línea 106');
  assert.ok(numbers.includes('123'), 'falta la Línea 123');
});

test('las rutas existentes del API siguen respondiendo igual (/meta)', async () => {
  const res = await fetch(`${base}/meta`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { api_version: 2 });
  // Las cabeceras nuevas son solo para /panel y /descargar -- no le cambian
  // el comportamiento a las rutas de siempre.
  assert.equal(res.headers.get('x-frame-options'), null);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});
