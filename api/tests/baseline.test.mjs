// Centinelas de `apply-migrations.sh --baseline` (deploy/baseline-sentinels.sh).
//
//   bash api/run-tests.sh tests/baseline.test.mjs
//
// --baseline marca migraciones como aplicadas SIN correrlas. Antes lo hacía
// sin mirar la base: sobre una base a medias, lo que faltaba quedaba marcado
// como hecho para siempre. Aquí se comprueba que cada migración tiene un
// centinela, que todos dan "sí" sobre la base de pruebas (que tiene todo) y
// "no" —sin error— sobre una base vacía o a medias.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OWNER_URL = process.env.OWNER_DATABASE_URL;
if (!OWNER_URL) throw new Error('Falta OWNER_DATABASE_URL. Usar api/run-tests.sh.');

const migrations = [
  ...fs.readdirSync(path.join(ROOT, 'deploy', 'migrations')).filter((f) => f.endsWith('.sql'))
    .map((f) => path.join(ROOT, 'deploy', 'migrations', f)),
  ...fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => path.join(ROOT, 'supabase', 'migrations', f)),
];

/** Centinela de cada migración, sacado del mismo script que usa apply-migrations. */
function sentinels() {
  const toBash = (p) => spawnSync('bash', ['-c', 'cygpath -u "$1" 2>/dev/null || echo "$1"', '_', p]).stdout.toString().trim();
  const r = spawnSync('bash', ['-c',
    '. "$1"; shift; for f in "$@"; do sentinel_for "$f" || echo "__SIN_CENTINELA__"; done',
    '_', toBash(path.join(ROOT, 'deploy', 'baseline-sentinels.sh')), ...migrations.map((m) => path.basename(m))]);
  assert.equal(r.status, 0, r.stderr.toString());
  const lines = r.stdout.toString().trim().split('\n');
  assert.equal(lines.length, migrations.length);
  return migrations.map((m, i) => ({ name: path.basename(m), file: m, sql: lines[i] }));
}

async function check(client, sql) {
  const { rows } = await client.query(`select coalesce((${sql}), false) as ok`);
  return rows[0].ok;
}

const list = sentinels();

test('cada migración tiene su centinela', () => {
  const sin = list.filter((s) => s.sql === '__SIN_CENTINELA__').map((s) => s.name);
  assert.deepEqual(sin, [], 'agregar su centinela en deploy/baseline-sentinels.sh');
});

test('sobre la base completa, todos los centinelas están', async () => {
  const client = new pg.Client({ connectionString: OWNER_URL });
  await client.connect();
  try {
    for (const s of list) assert.equal(await check(client, s.sql), true, `falta el centinela de ${s.name}`);
  } finally {
    await client.end();
  }
});

test('sobre una base vacía o a medias, los que faltan dan "no" (sin fallar)', async () => {
  const admin = new pg.Client({ connectionString: OWNER_URL });
  await admin.connect();
  const DB = 'raiz_centinelas_prueba';
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);
  const url = new URL(OWNER_URL);
  url.pathname = `/${DB}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    for (const s of list) assert.equal(await check(client, s.sql), false, `${s.name} en una base vacía`);

    // A medias: solo la capa de compatibilidad. Su centinela aparece, los del
    // esquema no — --baseline se negaría a marcarlos.
    await client.query(fs.readFileSync(list[0].file, 'utf8'));
    assert.equal(await check(client, list[0].sql), true, list[0].name);
    for (const s of list.slice(1)) assert.equal(await check(client, s.sql), false, `${s.name} sobre una base a medias`);
  } finally {
    await client.end();
    await admin.query(`drop database if exists ${DB}`);
    await admin.end();
  }
});
