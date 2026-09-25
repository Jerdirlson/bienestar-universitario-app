import http from 'node:http';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
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

// ── Páginas estáticas: panel de administración y descarga ──────────────────
//
// Antes vivían solo en admin-web/ y el panel apuntaba a una URL de API fija
// (un túnel de Cloudflare que ya no existe). Sirviéndolas aquí, el panel
// puede usar location.origin por defecto — una sola URL pública para todo —
// y la página de descarga puede leer APK_URL sin que nadie tenga que subir
// nada a mano. admin-web/ es hermano de api/ tanto en el repo como dentro de
// la imagen (api/Dockerfile las copia manteniendo esa disposición), así que
// la misma ruta relativa sirve en local y en Docker.
const ADMIN_WEB_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'admin-web'
);

// Cabeceras mínimas para contenido servido a un navegador de verdad (el resto
// del API responde JSON a un cliente que no renderiza nada de esto, así que
// no las necesita y no se tocan sus rutas). nosniff evita que el navegador
// intente reinterpretar el HTML como otra cosa; no-referrer evita filtrar la
// URL completa —con el token de sesión en el caso del panel— a quien reciba
// un enlace saliente; DENY evita que alguien la incruste en un iframe ajeno.
function staticSecurityHeaders(res) {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Referrer-Policy', 'no-referrer');
  res.header('X-Frame-Options', 'DENY');
}

// Panel de administración. admin-web/index.html decide él mismo la URL del
// API a partir de location.origin cuando llega por aquí (ver ese archivo).
app.get('/panel', (_req, res) => {
  staticSecurityHeaders(res);
  res.sendFile(path.join(ADMIN_WEB_DIR, 'index.html'), (error) => {
    // sendFile ya escribió cabeceras si llegó a encontrar el archivo; solo
    // falta responder algo si falló antes de eso (imagen mal armada, etc.).
    if (error && !res.headersSent) {
      console.error('[panel] no se pudo servir index.html:', error.message);
      res.status(500).json({ error: 'panel_no_disponible' });
    }
  });
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/**
 * Página de descarga (/descargar). Se genera en cada petición porque depende
 * de APK_URL, no de un archivo fijo: si algún día se rota el enlace del APK
 * basta con cambiar la variable de entorno y redesplegar, sin tocar nada más.
 *
 * Sin código QR: generarlo bien (con su propia corrección de errores) a mano
 * y sin ninguna librería es fácil de hacer mal y difícil de probar a fondo;
 * la propia tarea permite mostrar el enlace en texto grande en su lugar, que
 * es lo que hace esta página además del botón.
 */
function renderDownloadPage(apkUrl) {
  const hasApk = typeof apkUrl === 'string' && apkUrl.trim() !== '';
  const safeUrl = hasApk ? escapeHtml(apkUrl.trim()) : '';
  const downloadBlock = hasApk
    ? `<a class="btn" href="${safeUrl}">Descargar para Android</a>
      <p class="hint">¿El botón no hace nada? Copia este enlace en el navegador del teléfono:</p>
      <p class="link-text">${safeUrl}</p>`
    : `<div class="btn btn-disabled" role="note">Descarga disponible pronto</div>`;

  // Los dos únicos números de esta página son 106 y 123 — verificados en
  // src/data/crisisResources.js. No agregar ningún otro (ver CLAUDE.md).
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Raíz · Descargar</title>
<style>
  :root {
    --bg: #F0E9FF; --card: #ffffff; --ink: #1A1523; --ink-soft: #5C5770; --ink-muted: #9D98AB;
    --primary: #6B4EFF; --hair: rgba(26,21,35,0.08); --radius: 20px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: var(--bg); color: var(--ink);
    font-family: -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 28px 16px 48px;
  }
  .wrap { max-width: 420px; margin: 0 auto; }
  header { text-align: center; margin: 4px 0 26px; }
  .mark {
    width: 60px; height: 60px; border-radius: 18px; margin: 0 auto 14px;
    background: linear-gradient(135deg, #6B4EFF, #9A7DFF);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 24px;
  }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .tagline { color: var(--ink-soft); font-size: 14.5px; margin: 0; }
  .card {
    background: var(--card); border-radius: var(--radius); padding: 22px 20px;
    margin-bottom: 14px; box-shadow: 0 4px 20px rgba(74, 30, 150, 0.08);
  }
  .card h2 { font-size: 15px; margin: 0 0 12px; }
  .btn {
    display: block; box-sizing: border-box; text-align: center; text-decoration: none;
    border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 800;
    color: #fff; background: linear-gradient(135deg, #6B4EFF, #9A7DFF);
    box-shadow: 0 10px 24px rgba(107, 78, 255, 0.32);
  }
  .btn-disabled { background: var(--ink-muted); box-shadow: none; }
  .hint { font-size: 12.5px; color: var(--ink-muted); margin: 14px 0 6px; }
  .link-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
    word-break: break-all; background: var(--bg); border-radius: 10px; padding: 10px 12px; margin: 0;
  }
  ol { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; color: var(--ink-soft); }
  .notice {
    background: #FFE9A8; color: #7A5A12; border-radius: 14px; padding: 12px 14px;
    font-size: 13px; text-align: center; font-weight: 600; margin: 0 0 14px;
  }
  .crisis {
    background: #FF003D; color: #fff; border-radius: 14px; padding: 14px 16px;
    font-size: 13.5px; text-align: center; font-weight: 700; line-height: 1.5;
  }
  footer { text-align: center; color: var(--ink-muted); font-size: 12px; margin-top: 20px; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="mark">R</div>
      <h1>Raíz</h1>
      <p class="tagline">Bienestar para estudiantes de la UPB — demo</p>
    </header>

    <div class="card">
      <h2>Descargar para Android</h2>
      ${downloadBlock}
    </div>

    <div class="card">
      <h2>Cómo instalarla</h2>
      <ol>
        <li>Abre el archivo descargado desde las notificaciones o la carpeta de descargas.</li>
        <li>Android va a pedir permiso para instalar aplicaciones de origen desconocido: actívalo solo para esta descarga.</li>
        <li>Toca "Instalar" y espera a que termine.</li>
      </ol>
    </div>

    <div class="card">
      <h2>¿Tienes iPhone?</h2>
      <p style="font-size:14px;color:var(--ink-soft);margin:0;line-height:1.6;">
        Hay una versión de prueba para iPhone, pero el equipo la instala directamente en cada equipo. Pídesela a quien te compartió este enlace.
      </p>
    </div>

    <p class="notice">Demo en pruebas: no es un servicio oficial todavía.</p>

    <div class="card crisis">
      Si estás en crisis, llama ya a la Línea 106 (salud mental, nacional y gratuita) o al 123 (emergencias).
    </div>

    <footer>Raíz · UPB Bucaramanga</footer>
  </div>
</body>
</html>`;
}

app.get('/descargar', (_req, res) => {
  staticSecurityHeaders(res);
  res.type('html').send(renderDownloadPage(config.apkUrl));
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
// pathToFileURL y no `file://${process.argv[1]}`: en Windows argv[1] es
// "C:\...\server.js" y la comparación ingenua nunca coincidía, así que el
// proceso terminaba en silencio sin escuchar.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
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
