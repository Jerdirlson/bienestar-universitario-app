import http from 'node:http';
import express from 'express';
import { config, isProduction } from './config.js';
import { ping, closePool } from './db.js';
import { authRouter } from './auth.js';
import { postsRouter } from './posts.js';
import { adminRouter } from './admin.js';
import { exploreRouter } from './explore.js';
import { usersRouter } from './users.js';
import { meRouter } from './me.js';
import { notificationsRouter } from './notifications.js';
import { entriesRouter, journalRouter } from './journal.js';
import { challengesRouter } from './challenges.js';
import { attachRealtime } from './realtime.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// CORS abierto a propósito: la app móvil no lo necesita (React Native no
// aplica CORS), pero el panel de administración corre en un navegador, en
// otro origen. La sesión viaja en Authorization: Bearer, nunca en cookies,
// así que un Access-Control-Allow-Origin amplio no abre nada por CSRF —
// quien no tenga el token válido igual queda afuera en cada ruta.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/auth', authRouter);
app.use('/posts', postsRouter);
app.use('/admin', adminRouter);
app.use('/explore', exploreRouter);
app.use('/users', usersRouter);
app.use('/me', meRouter);
app.use('/notifications', notificationsRouter);
app.use('/entries', entriesRouter);
app.use('/journal', journalRouter);
app.use('/challenges', challengesRouter);

// Descubrimiento de versión, sin sesión: la app pregunta esto para saber si
// el servidor ya habla el contrato v2 (api/API.md). Un 404 aquí significa v1
// y la app oculta lo que v1 no tiene en vez de fallar.
app.get('/meta', (_req, res) => {
  res.json({ api_version: 2 });
});

/**
 * Salud del servicio. Comprueba de verdad que la base responde: un /health que
 * solo devuelve 200 porque el proceso está vivo no sirve para nada — el caso
 * que importa es justamente "el API está arriba pero no alcanza a Postgres".
 */
app.get('/health', async (_req, res) => {
  try {
    const dbOk = await ping();
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      service: 'raiz-api',
      db: dbOk ? 'ok' : 'sin respuesta',
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[health] base inalcanzable:', error.message);
    res.status(503).json({ ok: false, service: 'raiz-api', db: 'error' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Manejador de errores. Nunca devuelve el detalle al cliente en producción:
// los mensajes de Postgres pueden incluir contenido de una fila.
app.use((error, _req, res, _next) => {
  console.error('[error]', error);
  res.status(500).json({
    error: 'internal',
    ...(isProduction ? {} : { detail: error.message }),
  });
});

// Solo escucha cuando el archivo se ejecuta directamente (`node src/server.js`,
// que es lo que hace el Dockerfile) — no cuando las pruebas importan `app` para
// montarlo en su propio servidor efímero. Sin este guard, importar este módulo
// desde un test dispara un listen() real en config.port como efecto de lado.
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = http.createServer(app);
  attachRealtime(server);
  server.listen(config.port, () => {
    console.log(`[raiz-api] escuchando en :${config.port} (${config.env})`);
  });

  // Apagado ordenado: deja terminar las peticiones en curso antes de cortar.
  // Sin esto, un despliegue puede abortar el check-in que alguien está guardando.
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      console.log(`[raiz-api] ${signal} recibido, cerrando`);
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}

export { app };
