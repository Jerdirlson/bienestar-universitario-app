// Pruebas de los textos: ambos idiomas completos y módulos sin pisar la base.
//
// Cada módulo (src/i18n/*.js) agrega sus claves por su lado. Si uno redefine
// una clave de la base, cambia en silencio un texto de otra pantalla; si un
// idioma tiene una clave que el otro no, esa pantalla muestra "undefined".

import test from 'node:test';
import assert from 'node:assert/strict';

import { COPY, BASE_COPY } from '../src/i18n.js';
import { DIARY_COPY } from '../src/i18n/diary.js';
import { SOCIAL_COPY } from '../src/i18n/social.js';
import { WELLNESS_COPY } from '../src/i18n/wellness.js';

const MODULES = { diary: DIARY_COPY, social: SOCIAL_COPY, wellness: WELLNESS_COPY };

test('español e inglés tienen exactamente las mismas claves', () => {
  const es = Object.keys(COPY.es).sort();
  const en = Object.keys(COPY.en).sort();
  assert.deepEqual(es.filter(k => !en.includes(k)), [], 'claves solo en español');
  assert.deepEqual(en.filter(k => !es.includes(k)), [], 'claves solo en inglés');
});

test('ningún módulo redefine una clave de la base ni de otro módulo', () => {
  const seen = new Map(Object.keys(BASE_COPY.es).map(k => [k, 'base']));
  for (const [name, mod] of Object.entries(MODULES)) {
    for (const lang of ['es', 'en']) {
      for (const k of Object.keys(mod[lang])) {
        const owner = seen.get(k);
        assert.ok(!owner || owner === name, `"${k}" de ${name} ya existe en ${owner}`);
        if (lang === 'es') seen.set(k, name);
      }
    }
  }
});

test('ningún texto queda vacío o indefinido', () => {
  for (const lang of ['es', 'en']) {
    for (const [k, v] of Object.entries(COPY[lang])) {
      assert.ok(v !== undefined && v !== null && v !== '', `${lang}.${k} está vacío`);
    }
  }
});

// Una pantalla que usa t.algo inexistente muestra "undefined" o se cae (pasó
// con t.articles en el check-in). Solo revisa archivos que toman `t` del
// contexto, para no confundirlo con otras variables llamadas t.
test('toda clave t.x usada en pantallas y componentes existe', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const keys = new Set(Object.keys(COPY.es));
  const missing = [];
  for (const file of walk('src').filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/\{[^}]*\bt\b[^}]*\}\s*=\s*use(App|Social)\(\)/.test(src) && !/\bt\s*=\s*COPY\[/.test(src)) continue;
    for (const m of src.matchAll(/\bt\.([A-Za-z_]\w*)/g)) {
      if (!keys.has(m[1])) missing.push(`${file}: t.${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('la promesa de privacidad del diario es literalmente cierta', () => {
  // El diario vive en un servidor que opera la universidad: prometer que
  // "nadie de la universidad" puede leerlo no es verdad frente a quien opera
  // ese servidor. Lo cierto: dentro de la app nadie más lo lee.
  const es = COPY.es.privacyBody;
  const en = COPY.en.privacyBody;
  assert.doesNotMatch(es, /nadie de la universidad/i);
  assert.doesNotMatch(en, /no one at the university/i);
  assert.match(es, /dentro de la app nadie/i);
  assert.match(es, /servidor de la universidad/i);
  assert.match(en, /no one else in the app/i);
  assert.match(en, /university's server/i);
});
