// Límites de frecuencia de la comunidad, con los valores REALES.
//
//   bash api/run-tests.sh
//
// run-tests.sh sube los límites para que las demás pruebas puedan crear
// mucho contenido con pocas cuentas. Cada archivo de pruebas corre en su
// propio proceso, así que aquí se devuelven a los valores del contrato
// ANTES de cargar el servidor (config.js los lee al importarse).

process.env.RATE_LIMIT_POSTS_PER_HOUR = '10';
process.env.RATE_LIMIT_COMMENTS_PER_HOUR = '30';

const test = (await import('node:test')).default;
const assert = (await import('node:assert/strict')).default;
const { startApi } = await import('./helpers.mjs');

const { cuenta, call, stop } = await startApi();
const prolifica = await cuenta('limites-prolifica@upb.edu.co');
const otra = await cuenta('limites-otra@upb.edu.co');

test.after(stop);

test('más de 10 publicaciones por hora: 429 demasiadas_publicaciones', async () => {
  for (let i = 0; i < 10; i++) {
    const r = await call('POST', '/posts', prolifica.token, { body: `publicación ${i}` });
    assert.equal(r.status, 201, `la ${i + 1} debe pasar`);
  }
  const once = await call('POST', '/posts', prolifica.token, { body: 'una más' });
  assert.equal(once.status, 429);
  assert.equal(once.body.error, 'demasiadas_publicaciones');

  // El límite es por persona.
  assert.equal((await call('POST', '/posts', otra.token, { body: 'yo sí puedo' })).status, 201);
});

test('más de 30 comentarios por hora: 429 demasiados_comentarios', async () => {
  const { post } = (await call('POST', '/posts', otra.token, { body: 'comenten' })).body;
  for (let i = 0; i < 30; i++) {
    const r = await call('POST', `/posts/${post.id}/comments`, prolifica.token, { body: `comentario ${i}` });
    assert.equal(r.status, 201, `el ${i + 1} debe pasar`);
  }
  const r = await call('POST', `/posts/${post.id}/comments`, prolifica.token, { body: 'uno más' });
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'demasiados_comentarios');
});
