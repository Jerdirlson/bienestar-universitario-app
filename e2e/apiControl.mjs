// Apagar y volver a levantar el API desde una prueba, para el escenario
// "sin red": mismo truco que usaban los scripts de QA (buscar el proceso que
// escucha en el puerto por netstat y matarlo con taskkill, porque en Git Bash
// un `kill` normal sobre un proceso nativo de Windows lanzado en background
// no siempre lo termina de verdad). Los valores de conexión deben coincidir
// con los que usa e2e/run.sh al arrancar el API — si uno cambia, cambia el otro.
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.join(HERE, '..', 'api');
const PORT = new URL(process.env.E2E_API_URL || 'http://localhost:3000').port || '3000';

function pidOnPort(port) {
  const out = execSync('netstat -ano', { encoding: 'utf8' });
  const line = out.split('\n').find((l) => new RegExp(`:${port}\\s`).test(l) && /LISTENING/.test(l));
  return line ? line.trim().split(/\s+/).pop() : null;
}

/** Mata el proceso que escucha en el puerto del API. Devuelve el pid matado. */
export function stopApi() {
  const pid = pidOnPort(PORT);
  // execSync corre por cmd.exe, no por Git Bash: aquí SÍ van barras simples
  // (el truco de la barra doble es solo para cuando MSYS reescribe rutas de
  // un comando de bash antes de pasarlo a un binario nativo).
  if (pid) execSync(`taskkill /PID ${pid} /F`);
  return pid;
}

/** Vuelve a levantar el API con la misma configuración que e2e/run.sh. */
export async function startApi() {
  const child = spawn('node', ['src/server.js'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://raiz_app:pruebas-locales-app@127.0.0.1:15432/raiz',
      JWT_SECRET: 'solo-para-pruebas-e2e',
      PORT,
      RATE_LIMIT_POSTS_PER_HOUR: '100000',
      RATE_LIMIT_COMMENTS_PER_HOUR: '100000',
    },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const r = await fetch(`${process.env.E2E_API_URL || 'http://localhost:3000'}/health`);
      if (r.ok) return true;
    } catch { /* sigue esperando */ }
  }
  return false;
}
