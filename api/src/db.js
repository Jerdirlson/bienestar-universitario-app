import pg from 'pg';
import { config } from './config.js';

/**
 * Acceso a Postgres.
 *
 * Este archivo es la pieza de seguridad más delicada del backend. Todo lo que
 * toca datos de una persona pasa por `withUser`, que fija la identidad para que
 * Postgres aplique sus políticas de seguridad.
 *
 * El principio: **el backend no decide quién ve qué**. Lo decide la base. Si hay
 * un error en una consulta de aquí, la base sigue negando.
 */

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Un cliente inactivo que muere no debe tumbar el proceso.
  console.error('[db] error en cliente inactivo:', err.message);
});

/**
 * Ejecuta `fn` con la identidad de `userId` puesta, dentro de una transacción.
 *
 * Tres detalles que parecen menores y no lo son:
 *
 * 1. `set local role authenticated` — sin asumir ese rol, las políticas (que
 *    conceden a `authenticated`) no aplican y Postgres deniega. Falla cerrado.
 *
 * 2. El tercer argumento `true` de set_config hace el ajuste **local a la
 *    transacción**. Sin él el valor persiste en la conexión y, como el pool las
 *    reutiliza, la siguiente petición heredaría la identidad de la anterior:
 *    una persona leyendo el diario de otra. Es el error más grave posible aquí.
 *
 * 3. El rollback en el catch no es solo por los datos: devuelve la conexión al
 *    pool sin rol ni claims puestos.
 */
export async function withUser(userId, fn) {
  if (!userId) throw new Error('withUser requiere un userId');

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query(
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: userId })]
    );

    const result = await fn(client);

    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // Si el rollback falla la conexión ya está rota; release la descarta.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta `fn` sin identidad de usuario, como el rol `anon` — el mismo que
 * usaría un cliente sin sesión. Solo para lo que ocurre ANTES de que exista
 * una sesión: pedir o verificar un código de acceso.
 *
 * raiz_app es NOINHERIT (deploy/create-app-role.sh), así que sin este
 * `set local role` no hereda ni siquiera los permisos de `anon` y cualquier
 * consulta fallaría cerrada por falta de privilegios — que es la razón de
 * ser de NOINHERIT, pero acá sí necesitamos activarlo explícitamente.
 *
 * Nunca usar para leer contenido de una persona: eso va por withUser.
 */
export async function withoutUser(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role anon');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // Si el rollback falla la conexión ya está rota; release la descarta.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta `fn` como `service_role`: pasa por encima de TODAS las políticas de
 * seguridad, igual que el dueño de la base. No hay auth.uid() dentro de esta
 * transacción — nada se filtra por identidad, todo depende de que quien llama
 * ya haya verificado los permisos ANTES de entrar acá.
 *
 * Existe porque cambiar el estado de una publicación o un comentario no puede
 * hacerse como `authenticated`, ni siquiera siendo moderador: "Sin update para
 * authenticated... Moderar es cosa de service_role" (row_level_security.sql).
 * Los usos, todos después de un chequeo con la identidad real:
 *   - aplicar el filtro automático a lo que la persona ACABA de insertar con
 *     withUser (community.js → applyScreening, posts.js → PATCH);
 *   - moderar desde el panel, tras is_admin() (admin.js);
 *   - borrar la propia cuenta, con el id del token (auth.js → DELETE /account).
 * service_role no tiene ningún grant sobre el diario (entries,
 * journal_entries): ni siquiera por aquí se puede leer.
 *
 * Regla de oro: todo endpoint que use esto debe comprobar is_admin() (u
 * otra condición equivalente) con un withUser() normal ANTES de llamar a esto.
 * Nunca exponer esta función directamente a una ruta sin ese chequeo previo.
 */
export async function withServiceRole(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role service_role');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // Si el rollback falla la conexión ya está rota; release la descarta.
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Comprueba que la base responde. Para /health. */
export async function ping() {
  const { rows } = await pool.query('select 1 as ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  await pool.end();
}
