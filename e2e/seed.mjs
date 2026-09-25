// Siembra las cuentas de prueba fijas (estudiantes y un admin) que pide el
// enunciado del encargo. La mayoría de las pruebas crean sus propias cuentas
// aisladas (ver db.mjs:makeAccount) para poder correr en cualquier orden,
// pero estas quedan disponibles para pruebas puntuales y para explorar la
// app a mano mientras el runner está arriba.
import { psql } from './db.mjs';

const PASSWORD = 'clave-e2e-fija';

const ACCOUNTS = [
  { email: 'ana@upb.edu.co', role: 'student', name: null },
  { email: 'beto@upb.edu.co', role: 'student', name: null },
  { email: 'caro@upb.edu.co', role: 'student', name: null },
  { email: 'dani@upb.edu.co', role: 'student', name: null },
  { email: 'admin@upb.edu.co', role: 'admin', name: 'Administración Raíz' },
];

for (const { email, role, name } of ACCOUNTS) {
  psql(`delete from auth.users where email = '${email}'`);
  const id = psql(
    `insert into auth.users (email, password_hash) values ('${email}', crypt('${PASSWORD}', gen_salt('bf', 4))) returning id`
  );
  psql(`update public.profiles set role = '${role}' where id = '${id}'`);
  if (name) psql(`update public.profiles set display_name = '${name}' where id = '${id}'`);
  console.log(`  sembrada ${email} (${role})`);
}
console.log(`Contraseña de todas: ${PASSWORD}`);
