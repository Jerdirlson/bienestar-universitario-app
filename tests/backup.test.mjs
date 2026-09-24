// deploy/backup.sh: el volcado lleva el diario de todo el mundo, así que no
// puede quedar como un archivo cualquiera. Se corre el script de verdad con
// un `docker` falso en el PATH (no toca ninguna base).
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'deploy', 'backup.sh');
const SECRET = 'DIARIO-DE-PRUEBA-NO-DEBE-VERSE';

const hasBash = spawnSync('bash', ['-c', 'true']).status === 0;
const hasGpg = hasBash && spawnSync('bash', ['-c', 'command -v gpg']).status === 0;

function run(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raiz-backup-'));
  const bin = path.join(dir, 'bin');
  const out = path.join(dir, 'out');
  fs.mkdirSync(bin);
  // docker falso: `ps` dice que raiz-db corre, pg_dump escribe un volcado
  // reconocible y pg_restore --list lo acepta.
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
case "$*" in
  ps*) echo raiz-db ;;
  *pg_dump*) echo "${SECRET}" ;;
  *pg_restore*) cat > /dev/null ;;
esac
`, { mode: 0o755 });
  const toBash = (p) => spawnSync('bash', ['-c', 'cygpath -u "$1" 2>/dev/null || echo "$1"', '_', p]).stdout.toString().trim();
  const r = spawnSync('bash', [toBash(SCRIPT), toBash(out)], {
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      POSTGRES_USER: 'raiz_admin',
      BACKUP_PASSPHRASE: '',
      BACKUP_RECIPIENT: '',
      ...env,
    },
  });
  const files = fs.existsSync(out) ? fs.readdirSync(out) : [];
  return { r, out, files, stderr: r.stderr.toString(), stdout: r.stdout.toString() };
}

test('sin clave: respalda, pero avisa que queda sin cifrar; y nace legible solo por su dueño', { skip: !hasBash && 'sin bash' }, () => {
  const { r, out, files, stderr } = run();
  assert.equal(r.status, 0, stderr);
  assert.match(stderr, /SIN CIFRAR/);
  assert.equal(files.length, 1);
  assert.match(files[0], /^raiz-.*\.dump$/);
  if (process.platform !== 'win32') {
    const mode = fs.statSync(path.join(out, files[0])).mode & 0o777;
    assert.equal(mode & 0o077, 0, `permisos ${mode.toString(8)}: nadie más debe poder leerlo`);
  }
});

test('con BACKUP_PASSPHRASE: el volcado queda cifrado y no queda copia en claro', { skip: !hasGpg && 'sin gpg' }, () => {
  const { r, out, files, stderr } = run({ BACKUP_PASSPHRASE: 'frase de prueba' });
  assert.equal(r.status, 0, stderr);
  assert.doesNotMatch(stderr, /SIN CIFRAR/);
  assert.deepEqual(files.map((f) => f.replace(/raiz-\d+-\d+/, 'X')), ['X.dump.gpg']);
  const content = fs.readFileSync(path.join(out, files[0]));
  assert.ok(!content.includes(SECRET), 'el contenido no debe leerse en claro');
});

test('si se pidió age y no está instalado, no deja un volcado en claro', { skip: !hasBash && 'sin bash' }, () => {
  const noAge = spawnSync('bash', ['-c', 'command -v age']).status !== 0;
  if (!noAge) return;
  const { r, files } = run({ BACKUP_RECIPIENT: 'age1ejemplo' });
  assert.notEqual(r.status, 0);
  assert.deepEqual(files, []);
});
