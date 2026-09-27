import { withServiceRole } from './db.js';
import { sendCrisisAlert } from './mailer.js';
import { config } from './config.js';

/**
 * Alertas a moderadores/administradores del protocolo de crisis.
 *
 * Dos disparadores:
 *   · alertCrisisHeld() — algo ACABA de quedar retenido por crisis
 *     (posts.js/community.js lo llama, siempre DESPUÉS de responder al
 *     cliente y sin esperar el resultado: ver esos archivos).
 *   · startCrisisSummary() — cada hora, cuenta lo que sigue sin atender
 *     (crisis_handled_at is null) por más de 30 minutos.
 *
 * Regla de oro: esto NUNCA puede romper la petición que lo dispara ni tumbar
 * el proceso. Todo error se traga y se registra — ver el catch de cada
 * función. El correo nunca lleva el texto de lo retenido ni nada que
 * identifique a quien lo escribió: solo un conteo y el enlace al panel.
 */

async function moderatorEmails(client) {
  const { rows } = await client.query(
    `select u.email from auth.users u
       join public.profiles p on p.id = u.id
      where p.role in ('moderator', 'admin')`
  );
  return rows.map((r) => r.email);
}

async function pendingCrisisCount(client, { unattendedMinutes } = {}) {
  const cond = unattendedMinutes
    ? `and crisis_handled_at is null and created_at < now() - interval '${Number(unattendedMinutes)} minutes'`
    : '';
  const { rows } = await client.query(`
    select (
      (select count(*) from public.posts where status = 'pending' and held_reason = 'crisis' ${cond})
      + (select count(*) from public.post_comments where status = 'pending' and held_reason = 'crisis' ${cond})
    )::int as n`);
  return rows[0].n;
}

async function alertIfAny(client, opts) {
  const count = await pendingCrisisCount(client, opts);
  if (count < 1) return;
  const emails = await moderatorEmails(client);
  await sendCrisisAlert({ to: emails, count, panelUrl: config.panelUrl });
}

/**
 * Algo quedó retenido por crisis: avisa con el total de crisis pendientes
 * (no solo "una nueva" — quien lea el correo necesita el tamaño real de la
 * cola, no un conteo de eventos). Fire-and-forget: quien llama no espera el
 * resultado ni el error.
 */
export async function alertCrisisHeld() {
  try {
    await withServiceRole((client) => alertIfAny(client, {}));
  } catch (error) {
    console.error('[alerts] fallo enviando la alerta de crisis:', error.message);
  }
}

let summaryInterval = null;

/** Resumen cada hora de crisis sin atender hace más de 30 minutos. Apagable con MOD_ALERTS=false. */
export function startCrisisSummary() {
  if (!config.modAlertsEnabled || summaryInterval) return;
  summaryInterval = setInterval(async () => {
    try {
      await withServiceRole((client) => alertIfAny(client, { unattendedMinutes: 30 }));
    } catch (error) {
      console.error('[alerts] fallo en el resumen periódico de crisis:', error.message);
    }
  }, 60 * 60 * 1000);
  summaryInterval.unref?.();
}

export function stopCrisisSummary() {
  if (summaryInterval) {
    clearInterval(summaryInterval);
    summaryInterval = null;
  }
}
