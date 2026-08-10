// Pruebas de la lógica pura: fechas, rachas, validación, repositorio y los
// recursos de crisis.
//
//   npm test
//
// Los módulos de src/ son ESM y no importan nada de React Native salvo
// entriesRepository, que sí toca AsyncStorage — por eso el repositorio se
// prueba con el backend en memoria, sin simular el módulo nativo.

import test from 'node:test';
import assert from 'node:assert/strict';

import { dayKey, buildMonthGrid, monthLabel } from '../src/lib/dates.js';
import { computeStreak } from '../src/lib/streak.js';
import { normalizeEntry, InvalidEntryError } from '../src/data/entry.js';
import { createEntriesRepository, createMemoryBackend } from '../src/data/entriesRepository.js';
import { CRISIS_RESOURCES } from '../src/data/crisisResources.js';

// ── recursos de crisis ───────────────────────────────────────────────────────
//
// Estas pruebas existen porque el despliegue pasó a ser automático: una
// actualización llega a todos los teléfonos sin que nadie la revise. Un botón
// muerto en la pantalla de crisis es el peor fallo posible de esta app, así que
// tiene que romper el pipeline antes de salir.

test('hay al menos un recurso de crisis accionable', () => {
  const accionables = CRISIS_RESOURCES.filter(r => r.kind !== 'pending');
  assert.ok(accionables.length > 0, 'ningún recurso de crisis es accionable');
});

test('todo recurso accionable tiene destino y forma de mostrarlo', () => {
  for (const r of CRISIS_RESOURCES.filter(x => x.kind !== 'pending')) {
    assert.ok(r.target, `${r.id}: sin target`);
    assert.ok(r.display, `${r.id}: sin display para marcar a mano si falla abrir`);
    assert.ok(['tel', 'whatsapp'].includes(r.kind), `${r.id}: kind desconocido "${r.kind}"`);
  }
});

test('los números de teléfono son marcables', () => {
  for (const r of CRISIS_RESOURCES.filter(x => x.kind === 'tel')) {
    assert.match(r.target, /^[0-9+#*]+$/, `${r.id}: target no marcable`);
  }
});

test('el WhatsApp lleva indicativo de país y sin signos', () => {
  // wa.me exige solo dígitos, con indicativo de país y sin '+'.
  for (const r of CRISIS_RESOURCES.filter(x => x.kind === 'whatsapp')) {
    assert.match(r.target, /^\d{10,15}$/, `${r.id}: target inválido para wa.me`);
  }
});

test('cada recurso tiene textos en ambos idiomas', () => {
  for (const r of CRISIS_RESOURCES) {
    for (const lang of ['es', 'en']) {
      assert.ok(r[lang]?.title, `${r.id}: falta ${lang}.title`);
      assert.ok(r[lang]?.sub, `${r.id}: falta ${lang}.sub`);
      assert.ok(r[lang]?.action, `${r.id}: falta ${lang}.action`);
    }
  }
});

test('los identificadores de recurso no se repiten', () => {
  const ids = CRISIS_RESOURCES.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids duplicados');
});

// ── fechas ───────────────────────────────────────────────────────────────────

test('dayKey usa hora local y rellena con ceros', () => {
  assert.equal(dayKey(new Date(2026, 7, 9, 23, 30)), '2026-08-09');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('buildMonthGrid arma semanas que empiezan en lunes', () => {
  const g = buildMonthGrid(2026, 7); // agosto 2026, empieza sábado
  assert.equal(g.flat().length % 7, 0);
  assert.equal(g.flat().filter(Boolean).length, 31);
  assert.equal(g[0].indexOf(1), 5, 'el 1 de agosto de 2026 cae sábado');
});

test('buildMonthGrid maneja febrero bisiesto', () => {
  assert.equal(buildMonthGrid(2028, 1).flat().filter(Boolean).length, 29);
});

test('monthLabel capitaliza en ambos idiomas', () => {
  // En español el formato correcto lleva «de»: «Agosto de 2026».
  assert.equal(monthLabel(2026, 7, 'es'), 'Agosto de 2026');
  assert.equal(monthLabel(2026, 7, 'en'), 'August 2026');
});

// ── rachas ───────────────────────────────────────────────────────────────────

const at = (d) => ({ entryDate: d });
const TODAY = new Date(2026, 7, 9, 20, 0);

test('sin registros la racha es cero', () => {
  assert.equal(computeStreak([], TODAY), 0);
  assert.equal(computeStreak(null, TODAY), 0);
});

test('cuenta días consecutivos hacia atrás', () => {
  assert.equal(computeStreak([at('2026-08-09')], TODAY), 1);
  assert.equal(computeStreak(['2026-08-09', '2026-08-08', '2026-08-07'].map(at), TODAY), 3);
});

test('la racha sigue viva si hoy aún no hay registro', () => {
  assert.equal(computeStreak(['2026-08-08', '2026-08-07'].map(at), TODAY), 2);
});

test('un hueco corta la racha', () => {
  assert.equal(computeStreak(['2026-08-09', '2026-08-07'].map(at), TODAY), 1);
  assert.equal(computeStreak([at('2026-07-01')], TODAY), 0);
});

test('cruza el cambio de mes', () => {
  const entries = ['2026-08-01', '2026-07-31', '2026-07-30'].map(at);
  assert.equal(computeStreak(entries, new Date(2026, 7, 1, 9, 0)), 3);
});

test('ignora entradas sin entryDate en vez de romperse', () => {
  assert.equal(computeStreak([{ mood: 3 }, at('2026-08-09')], TODAY), 1);
});

// ── validación ───────────────────────────────────────────────────────────────

test('normalizeEntry rellena la fecha con el día de hoy', () => {
  const e = normalizeEntry({ mood: 3 }, TODAY);
  assert.equal(e.entryDate, '2026-08-09');
  assert.deepEqual(e.feelings, []);
  assert.equal(e.note, '');
});

test('normalizeEntry rechaza ánimos fuera de rango', () => {
  for (const mood of [-1, 5, 2.5, '3', null, undefined]) {
    assert.throws(() => normalizeEntry({ mood }, TODAY), InvalidEntryError, `mood=${mood}`);
  }
});

test('normalizeEntry rechaza fechas mal formadas', () => {
  assert.throws(() => normalizeEntry({ mood: 3, entryDate: '9/8/2026' }, TODAY), InvalidEntryError);
});

test('normalizeEntry corta notas demasiado largas', () => {
  assert.throws(() => normalizeEntry({ mood: 3, note: 'x'.repeat(4001) }, TODAY), InvalidEntryError);
});

test('normalizeEntry deduplica y limpia claves', () => {
  const e = normalizeEntry({ mood: 3, causes: [' sueno ', 'sueno', 'estudios'] }, TODAY);
  assert.deepEqual(e.causes, ['sueno', 'estudios']);
});

// ── repositorio ──────────────────────────────────────────────────────────────

const freshRepo = () => createEntriesRepository(createMemoryBackend());

test('el repositorio arranca vacío', async () => {
  assert.deepEqual(await freshRepo().list(), []);
});

test('guarda y relee un check-in', async () => {
  const repo = freshRepo();
  await repo.upsert({ mood: 4, note: 'buen día', causes: ['sueno'] }, TODAY);
  const [saved] = await repo.list();
  assert.equal(saved.mood, 4);
  assert.equal(saved.note, 'buen día');
  assert.deepEqual(saved.causes, ['sueno']);
});

test('un registro por día: el último gana y conserva createdAt', async () => {
  const repo = freshRepo();
  const first = await repo.upsert({ mood: 1, note: 'temprano' }, TODAY);
  const later = await repo.upsert({ mood: 4, note: 'más tarde' }, new Date(2026, 7, 9, 23, 0));

  const all = await repo.list();
  assert.equal(all.length, 1, 'no debe haber dos registros del mismo día');
  assert.equal(all[0].note, 'más tarde');
  assert.equal(later.createdAt, first.createdAt, 'createdAt original se conserva');
  assert.notEqual(later.updatedAt, first.updatedAt);
});

test('días distintos conviven y se listan del más reciente al más antiguo', async () => {
  const repo = freshRepo();
  await repo.upsert({ mood: 2, entryDate: '2026-08-07' }, TODAY);
  await repo.upsert({ mood: 3, entryDate: '2026-08-09' }, TODAY);
  await repo.upsert({ mood: 1, entryDate: '2026-08-08' }, TODAY);

  const dates = (await repo.list()).map(e => e.entryDate);
  assert.deepEqual(dates, ['2026-08-09', '2026-08-08', '2026-08-07']);
});

test('getByDate encuentra el día pedido', async () => {
  const repo = freshRepo();
  await repo.upsert({ mood: 3, entryDate: '2026-08-09' }, TODAY);
  assert.equal((await repo.getByDate('2026-08-09')).mood, 3);
  assert.equal(await repo.getByDate('2026-08-08'), null);
});

test('clear borra el histórico', async () => {
  const repo = freshRepo();
  await repo.upsert({ mood: 3 }, TODAY);
  await repo.clear();
  assert.deepEqual(await repo.list(), []);
});

test('un guardado corrupto no rompe la app', async () => {
  const repo = createEntriesRepository(createMemoryBackend({ 'raiz.entries.v1': '{no es json' }));
  assert.deepEqual(await repo.list(), []);
});

test('un check-in inválido no se guarda a medias', async () => {
  const repo = freshRepo();
  await repo.upsert({ mood: 3, entryDate: '2026-08-09' }, TODAY);
  await assert.rejects(() => repo.upsert({ mood: 99 }, TODAY), InvalidEntryError);
  assert.equal((await repo.list()).length, 1, 'el histórico previo queda intacto');
});

// ── integración: repositorio + racha ─────────────────────────────────────────

test('la racha refleja lo que hay guardado', async () => {
  const repo = freshRepo();
  for (const d of ['2026-08-09', '2026-08-08', '2026-08-07']) {
    await repo.upsert({ mood: 3, entryDate: d }, TODAY);
  }
  assert.equal(computeStreak(await repo.list(), TODAY), 3);
});
