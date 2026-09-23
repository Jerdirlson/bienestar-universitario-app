// Pruebas del contenido de bienestar: artículos con fuente oficial, sin
// números de crisis fuera de crisisResources.js, búsqueda y respiración.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ARTICLES, getArticle, searchArticles, normalizeText } from '../src/data/wellnessContent.js';
import {
  TECHNIQUES, DURATIONS, getTechnique, cycleMs, breathsPerMinute, sessionLengthMs, phaseAt, phaseTargetScale,
} from '../src/data/breathing.js';
import { WELLNESS_COPY } from '../src/i18n/wellness.js';
import { CRISIS_RESOURCES } from '../src/data/crisisResources.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OFFICIAL = ['who.int', 'apa.org', 'nhs.uk', 'nimh.nih.gov', 'minsalud.gov.co'];

test('hay entre 6 y 10 artículos con id único', () => {
  assert.ok(ARTICLES.length >= 6 && ARTICLES.length <= 10);
  assert.equal(new Set(ARTICLES.map(a => a.id)).size, ARTICLES.length);
});

test('cada artículo cita al menos una fuente oficial con enlace https', () => {
  for (const a of ARTICLES) {
    assert.ok(a.sources?.length > 0, `${a.id}: sin fuente`);
    for (const s of a.sources) {
      assert.ok(s.name, `${a.id}: fuente sin nombre`);
      const host = new URL(s.url).hostname;
      assert.equal(new URL(s.url).protocol, 'https:');
      assert.ok(OFFICIAL.some(d => host === d || host.endsWith(`.${d}`)), `${a.id}: ${host} no es fuente oficial`);
    }
  }
});

test('cada artículo está completo en ambos idiomas', () => {
  for (const a of ARTICLES) {
    for (const lang of ['es', 'en']) {
      const c = a[lang];
      assert.ok(c?.title && c?.summary, `${a.id}.${lang}: falta título o resumen`);
      assert.ok(c.sections?.length > 0, `${a.id}.${lang}: sin secciones`);
      for (const s of c.sections) assert.ok(s.h || s.p || s.list?.length, `${a.id}.${lang}: sección vacía`);
    }
    assert.equal(a.es.sections.length, a.en.sections.length, `${a.id}: secciones distintas entre idiomas`);
  }
});

test('ningún teléfono en el contenido: los recursos de crisis viven solo en crisisResources.js', async () => {
  const src = await readFile(path.join(HERE, '../src/data/wellnessContent.js'), 'utf8');
  // Quita las URLs (llevan números de publicación) y busca secuencias marcables.
  const text = src
    .replace(/https:\/\/\S+/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ''); // fechas de revisión
  // Un número corto (106, 123…) solo se admite si ya está verificado en crisisResources.js.
  const verified = new Set(CRISIS_RESOURCES.map(r => r.target).filter(Boolean));
  const short = (text.match(/\b\d{3,4}\b/g) ?? []).filter(n => !/^20\d\d$/.test(n)); // años aparte
  assert.deepEqual(short.filter(n => !verified.has(n)), [], 'número corto no verificado (¿una línea de ayuda?)');
  const phoneLike = (text.match(/\d[\d\s-]*\d/g) ?? []).filter(s => s.replace(/\D/g, '').length >= 7);
  assert.deepEqual(phoneLike, [], 'hay algo con forma de teléfono');
  assert.doesNotMatch(text, /wa\.me|tel:/i);
});

test('los artículos sobre crisis llevan a la pantalla de Apoyo', () => {
  assert.ok(getArticle('help-a-friend').sos);
  assert.ok(getArticle('when-to-ask-for-help').sos);
  assert.equal(getArticle('no-existe'), null);
});

test('sin -e inclusivo en el contenido', () => {
  for (const a of ARTICLES) {
    const text = JSON.stringify(a.es);
    assert.doesNotMatch(text, /\b(todes|elles|amigue|chiques|nosotres)\b/i, `${a.id}`);
  }
});

test('búsqueda: sin tildes, sin mayúsculas, todas las palabras', () => {
  assert.equal(normalizeText('  Sueño ÁNIMO '), 'sueno animo');
  assert.deepEqual(searchArticles('', 'es').length, ARTICLES.length);
  assert.ok(searchArticles('ANSIEDAD', 'es').some(a => a.id === 'anxiety'));
  assert.equal(searchArticles('ansiedad', 'es')[0].id, 'anxiety', 'coincidencia en el título primero');
  assert.ok(searchArticles('dormir', 'es').some(a => a.id === 'sleep'));
  assert.ok(searchArticles('sleep', 'en').some(a => a.id === 'sleep'));
  assert.deepEqual(searchArticles('xyzzy', 'es'), []);
  assert.deepEqual(searchArticles('ansiedad xyzzy', 'es'), []);
});

test('respiración: las tres técnicas pedidas', () => {
  assert.deepEqual(TECHNIQUES.map(t => t.id).sort(), ['478', 'box', 'slow']);
  assert.equal(breathsPerMinute(getTechnique('slow')), 6);
  assert.deepEqual(getTechnique('box').phases.map(p => p.seconds), [4, 4, 4, 4]);
  assert.deepEqual(getTechnique('478').phases.map(p => p.seconds), [4, 7, 8]);
  assert.equal(getTechnique('nada').id, 'slow');
  assert.ok(DURATIONS.length >= 2);
});

test('respiración: fase según el tiempo y sesión en ciclos completos', () => {
  const t = getTechnique('478');
  assert.equal(cycleMs(t), 19000);
  assert.equal(phaseAt(t, 0).kind, 'inhale');
  assert.equal(phaseAt(t, 4000).kind, 'hold');
  assert.equal(phaseAt(t, 11000).kind, 'exhale');
  assert.equal(phaseAt(t, 18999).remainingMs, 1);
  assert.equal(phaseAt(t, 19000).cycle, 1);
  const total = sessionLengthMs(t, 1);
  assert.equal(total, 4 * 19000, '1 minuto = 4 ciclos completos de 4-7-8');
  assert.equal(phaseAt(t, total, total).done, true);
  assert.equal(phaseTargetScale('inhale'), 1);
  assert.equal(phaseTargetScale('hold'), null);
});

test('textos de bienestar: prefijo propio para no chocar con otros módulos', () => {
  for (const lang of ['es', 'en']) {
    for (const k of Object.keys(WELLNESS_COPY[lang])) assert.match(k, /^wl[A-Z]/, `${k} sin prefijo wl`);
  }
});
