// PUSH_ENABLED=false apaga todo el envío de push (api/src/config.js), sin
// tocar nada más. Corre en un proceso hijo aparte a propósito: config.js lee
// process.env una sola vez al importarse, y node --test con varios archivos
// los corre en el mismo proceso — fijar la variable acá se filtraría a los
// demás archivos si se hiciera en este mismo proceso. Ver el fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures', 'push-disabled-check.mjs');

test('PUSH_ENABLED=false: ninguna notificación manda push, aunque haya token registrado', () => {
  const r = spawnSync(process.execPath, [FIXTURE], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PUSH_ENABLED: 'false',
      // Nunca debería llegar a usarlos (vuelve antes de tocar la base), pero
      // config.js exige que existan para poder importarse.
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://placeholder/db',
      JWT_SECRET: process.env.JWT_SECRET ?? 'solo-para-pruebas',
    },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'NOT_CALLED', 'con PUSH_ENABLED=false no debería llamarse a Expo nunca');
});
