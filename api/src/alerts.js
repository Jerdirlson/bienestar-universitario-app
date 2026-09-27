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
 * Cada disparo intenta DOS canales: un correo (api/src/mailer.js — sin SMTP
 * configurado no falla, solo lo registra en el log, así que hoy en la
 * práctica no llega) y una notificación `moderation_alert` dentro de la app,
 * en la campanita de cada moderador/administrador (migración
 * …_moderator_alerts.sql). Esta última es la que el dueño del producto
 * espera ver mientras no haya un remitente de correo institucional.
 *
 * Regla de oro: esto NUNCA puede romper la petición que lo dispara ni tumbar
 * el proceso. Todo error se traga y se registra — ver el catch de cada
 * función, y el de cada canal por separado dentro de alertIfAny() (que uno
 * falle no debe impedir el otro). Ni el correo ni la notificación llevan el
 * texto de lo retenido ni nada que identifique a quien lo escribió: solo un
 * conteo (el correo) o un aviso genérico (la notificación) y el enlace al
 * panel.
 */

async function moderatorProfiles(client) {
  const { rows } = await client.query(
    `select p.id, u.email from auth.users u
       join public.profiles p on p.id = u.id
      where p.role in ('moderator', 'admin')`
  );
  return rows;
}

/**
 * Notificación `moderation_alert` para cada moderador/administrador.
 * Deduplicada: si alguien ya tiene una sin leer, no se le crea otra — si no,
 * un moderador que no revisa la campanita en un rato terminaría con una fila
 * por cada publicación retenida y por cada resumen horario. La misma regla
 * aplica al disparo inmediato (alertCrisisHeld) y al resumen periódico
 * (startCrisisSummary): ambos llaman a esta misma función.
 */
async function notifyModerators(client, moderatorIds) {
  if (moderatorIds.length === 0) return;
  await client.query(
    `insert into public.notifications (recipient_id, kind, actor_visible, excerpt)
     select m.id, 'moderation_alert', false, null
       from unnest($1::uuid[]) as m(id)
      where not exists (
        select 1 from public.notifications n
         where n.recipient_id = m.id and n.kind = 'moderation_alert' and n.read_at is null
      )`,
    [moderatorIds]
  );
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
  const moderators = await moderatorProfiles(client);

  // Cada canal en su propio try: que el correo falle no debe impedir la
  // notificación in-app, ni al revés.
  try {
    await sendCrisisAlert({ to: moderators.map((m) => m.email), count, panelUrl: config.panelUrl });
  } catch (error) {
    console.error('[alerts] fallo enviando el correo de crisis:', error.message);
  }
  try {
    await notifyModerators(client, moderators.map((m) => m.id));
  } catch (error) {
    console.error('[alerts] fallo creando la notificación in-app de crisis:', error.message);
  }
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
