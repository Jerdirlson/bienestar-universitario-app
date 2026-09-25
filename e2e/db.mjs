// Acceso directo a Postgres para la suite e2e: sembrar cuentas y verificar
// lo que quedó guardado, igual que hacían los scripts de QA en
// %TEMP%/raiz-qa/lib.mjs (función psql). Se usa `docker exec` en vez del
// paquete `pg` para no añadir otra dependencia solo para esto — el contrato
// real entre la app y la base ya lo prueban api/tests y supabase/tests.
import { execFileSync } from 'node:child_process';

const CONTAINER = 'raiz-db';

/** Corre SQL como raiz_admin (dueño, sin RLS) y devuelve la salida en texto,
 * filas separadas por salto de línea y columnas por '|'. Para una sola
 * columna/fila, el resultado ya viene listo para usar tal cual. */
export function psql(sql) {
  // -q: sin "INSERT 0 1" ni avisos — si no, un `insert ... returning id`
  // devuelve dos líneas y rompe a quien espera un solo valor.
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-q', '-U', 'raiz_admin', '-d', 'raiz', '-At', '-F', '|', '-c', sql],
    { encoding: 'utf8' }
  ).trim();
}

/** Igual que psql pero separa filas y columnas ya en arreglos. */
export function psqlRows(sql) {
  const out = psql(sql);
  if (!out) return [];
  return out.split('\n').map((line) => line.split('|'));
}

let counter = 0;
/** Id corto y único por proceso — con el pid y un contador basta para no
 * chocar entre archivos de prueba que corren en paralelo. */
function uniqueSuffix() {
  counter += 1;
  return `${process.pid}${Date.now().toString(36)}${counter}`;
}

/**
 * Crea (o reemplaza) una cuenta de prueba directamente en la base, igual que
 * hace api/tests/helpers.mjs: no hay pantalla de registro en la app — las
 * cuentas las provee la institución — así que "crear cuenta" en esta suite
 * es exactamente lo que hará el aprovisionamiento real algún día.
 *
 * @param {object} opts
 * @param {string} [opts.prefix] prefijo legible para el correo (por defecto 'qa')
 * @param {string} [opts.password] contraseña en claro (por defecto 'clave-e2e')
 * @param {'student'|'moderator'|'admin'} [opts.role]
 * @param {string} [opts.displayName]
 */
export function makeAccount({ prefix = 'qa', password = 'clave-e2e', role, displayName } = {}) {
  const email = `${prefix}-${uniqueSuffix()}@upb.edu.co`;
  psql(`delete from auth.users where email = '${email}'`);
  const id = psql(
    `insert into auth.users (email, password_hash) values ('${email}', crypt('${password}', gen_salt('bf', 4))) returning id`
  );
  if (role) psql(`update public.profiles set role = '${role}' where id = '${id}'`);
  if (displayName) psql(`update public.profiles set display_name = '${displayName.replace(/'/g, "''")}' where id = '${id}'`);
  const publicId = psql(`select public_id from public.profiles where id = '${id}'`);
  return { id, email, password, publicId };
}

/** Borra la cuenta y lo que le pertenezca en cascada (las FK del esquema ya
 * lo hacen), para dejar el runner limpio si una prueba lo pide. */
export function dropAccount(email) {
  psql(`delete from auth.users where email = '${email.replace(/'/g, "''")}'`);
}
