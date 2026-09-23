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
