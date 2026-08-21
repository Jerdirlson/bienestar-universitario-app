// Pruebas de la capa de acceso a datos contra un Postgres real.
//
//   bash api/run-tests.sh
//
// Estas pruebas existen por una razón concreta: `withUser` es lo único que se
// interpone entre una persona y el diario de otra. Si falla, no falla ruidoso —
// devuelve datos ajenos con HTTP 200. Así que aquí no se comprueba que funcione:
// se intenta romper.

import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const OWNER_URL = process.env.OWNER_DATABASE_URL;
if (!process.env.DATABASE_URL || !OWNER_URL) {
  throw new Error('Faltan DATABASE_URL y OWNER_DATABASE_URL. Usar api/run-tests.sh.');
}

const { withUser, withoutUser, ping, closePool } = await import('../src/db.js');

const ANA = '77777777-0000-0000-0000-000000000001';
const BETO = '77777777-0000-0000-0000-000000000002';

// La siembra va con el dueño, que no está sujeto a las políticas.
const owner = new pg.Client({ connectionString: OWNER_URL });
await owner.connect();
await owner.query(`delete from auth.users where id in ($1, $2)`, [ANA, BETO]);
await owner.query(
  `insert into auth.users (id, email) values ($1, 'ana@upb.edu.co'), ($2, 'beto@upb.edu.co')`,
  [ANA, BETO]
);
await owner.query(
  `insert into public.entries (user_id, entry_date, mood, note) values
     ($1, '2026-03-01', 4, 'diario de Ana'),
     ($2, '2026-03-01', 1, 'diario de Beto')`,
  [ANA, BETO]
);

test.after(async () => {
  await owner.query(`delete from auth.users where id in ($1, $2)`, [ANA, BETO]);
  await owner.end();
  await closePool();
});

// ── conectividad ─────────────────────────────────────────────────────────────

test('ping responde', async () => {
  assert.equal(await ping(), true);
});

// ── aislamiento entre personas ───────────────────────────────────────────────

test('withUser deja ver solo lo propio', async () => {
  const notas = await withUser(ANA, async (c) => {
    const { rows } = await c.query('select note from public.entries');
    return rows.map(r => r.note);
  });
  assert.deepEqual(notas, ['diario de Ana']);
});

test('otra identidad ve otra cosa', async () => {
  const notas = await withUser(BETO, async (c) => {
    const { rows } = await c.query('select note from public.entries');
    return rows.map(r => r.note);
  });
  assert.deepEqual(notas, ['diario de Beto']);
});

// ── el fallo grave: fuga de identidad entre peticiones ───────────────────────

test('la identidad NO se filtra a la siguiente petición del pool', async () => {
  // Se alternan las identidades muchas veces para forzar la reutilización de
  // conexiones. Si a set_config le faltara el `true`, el ajuste sobreviviría a
  // la transacción y alguna de estas leería el diario del anterior.
  for (let i = 0; i < 25; i++) {
    const quien = i % 2 === 0 ? ANA : BETO;
    const esperado = i % 2 === 0 ? 'diario de Ana' : 'diario de Beto';
    const notas = await withUser(quien, async (c) => {
      const { rows } = await c.query('select note from public.entries');
      return rows.map(r => r.note);
    });
    assert.deepEqual(notas, [esperado], `iteración ${i}: identidad filtrada`);
  }
});

test('withoutUser no hereda la identidad de un withUser previo', async () => {
  await withUser(ANA, async (c) => {
    await c.query('select 1');
  });

  // Sin asumir `authenticated` no hay ninguna política que conceda acceso, así
  // que Postgres deniega. Falla cerrado, que es lo que queremos.
  await assert.rejects(
    () => withoutUser(c => c.query('select note from public.entries')),
    /permission denied|no autorizado/i,
    'withoutUser debería quedar sin permisos, no heredar los de Ana'
  );
});

// ── transacciones ────────────────────────────────────────────────────────────

test('un error dentro de withUser revierte la escritura', async () => {
  await assert.rejects(() =>
    withUser(ANA, async (c) => {
      await c.query(
        `insert into public.entries (user_id, entry_date, mood, note)
         values ($1, '2026-03-02', 3, 'no debe quedar')`, [ANA]
      );
      throw new Error('fallo simulado');
    })
  );

  const quedan = await withUser(ANA, async (c) => {
    const { rows } = await c.query(
      `select count(*)::int as n from public.entries where entry_date = '2026-03-02'`
    );
    return rows[0].n;
  });
  assert.equal(quedan, 0, 'la escritura debió revertirse');
});

test('withUser exige identidad', async () => {
  await assert.rejects(() => withUser(null, async () => {}), /requiere un userId/);
});

// ── las políticas siguen aplicando a través de esta capa ─────────────────────

test('no se puede escribir a nombre de otra persona', async () => {
  await assert.rejects(() =>
    withUser(ANA, async (c) => {
      await c.query(
        `insert into public.entries (user_id, entry_date, mood) values ($1, '2026-03-03', 3)`,
        [BETO]
      );
    }),
    /row-level security|permission denied/i
  );
});
