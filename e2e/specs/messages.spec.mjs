// Mensajes privados: dos cuentas se siguen, activan los mensajes, solicitud,
// aceptar, conversar, un mensaje con datos de contacto queda bloqueado, y
// reportar deja un caso para moderación.
import { test, expect, newStudent } from '../fixtures.mjs';
import { login, tap, tapText, tapLabel, vis, sleep, marker } from '../ui.mjs';
import { api, apiLogin } from '../api.mjs';
import { psql } from '../db.mjs';

async function publishNamed(tok, body) {
  const r = await api('POST', '/posts', tok, { body, isAnonymous: false, topic: 'general' });
  return r.body.post;
}

/** Activa "Recibir mensajes" desde Perfil y confirma en la base. */
async function enableMessages(page, userId) {
  await tapLabel(page, 'Perfil');
  await sleep(1000);
  await tapLabel(page, 'Recibir mensajes');
  await sleep(600);
  expect(psql(`select messages_enabled from profiles where id = '${userId}'`)).toBe('t');
  await tapLabel(page, 'Volver');
  await sleep(400);
}

test.describe('mensajes privados', () => {
  test('seguirse, activar, solicitud, aceptar, conversar, mensaje con correo bloqueado, reportar', async ({ page, browser }) => {
    const anaName = `AnaDM${marker()}`;
    const betoName = `BetoDM${marker()}`;
    const ana = newStudent({ displayName: anaName });
    const beto = newStudent({ displayName: betoName });
    const tokAna = await apiLogin(ana.email, ana.password);
    const tokBeto = await apiLogin(beto.email, beto.password);

    // Seguimiento mutuo (el flujo de "Seguir" desde la UI ya lo cubre
    // community-social.spec.mjs; aquí importa la mensajería).
    await api('POST', `/users/${ana.publicId}/follow`, tokBeto);
    await api('POST', `/users/${beto.publicId}/follow`, tokAna);

    // Beto publica con nombre para que Ana pueda llegar a su perfil desde el feed.
    const mk = marker('dm');
    await publishNamed(tokBeto, `Post de Beto para encontrarlo ${mk}`);

    // ── Los dos activan "Recibir mensajes" ANTES de que Ana intente
    //    escribirle a Beto: el botón "Enviar mensaje" del perfil solo
    //    aparece cuando la otra persona ya lo activó (can_message, ver
    //    api/API.md) — si Beto lo activara después, el botón nunca saldría.
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page2 = await ctx2.newPage();
    await login(page2, beto.email, beto.password);
    await enableMessages(page2, beto.id);

    await login(page, ana.email, ana.password);
    await enableMessages(page, ana.id);

    // Seguirse mutuamente por API ya dejó una notificación "new_follower" sin
    // leer: la pestaña Comunidad trae el badge en la etiqueta ("Comunidad
    // (1)", ver src/components/TabBar.js) — el prefijo alcanza haya o no
    // badge (mismo patrón que community-social.spec.mjs).
    await tapLabel(page, /^Comunidad/);
    await sleep(1200);
    // Se toca el ALIAS directo desde la tarjeta del feed (como en
    // community-social.spec.mjs) para abrir su perfil sin pasar por el
    // detalle de la publicación — un nivel menos que "volver" más adelante.
    await tap(vis(page, new RegExp(betoName)).last());
    await sleep(1000);
    await tapText(page, 'Enviar mensaje');
    await sleep(1000);
    await page.locator('textarea').filter({ visible: true }).last().fill('Hola Beto, ¿hablamos por aquí?');
    await tapText(page, 'Enviar');
    await sleep(1500);
    await expect(vis(page, 'Esperando que acepte tu solicitud', false)).toBeVisible({ timeout: 6000 });

    const convId = psql(`select id from conversations where requested_by = '${ana.id}'`);
    expect(convId).toBeTruthy();
    expect(psql(`select count(*) from messages where conversation_id = '${convId}'`)).toBe('1');

    // ── Beto: ve la solicitud y la acepta ─────────────────────────────────
    await tapLabel(page2, /^Comunidad/);
    await sleep(1200);
    await tapLabel(page2, 'Mensajes');
    await sleep(1000);
    await tapLabel(page2, /Solicitudes/);
    await sleep(800);
    await expect(vis(page2, 'Hola Beto, ¿hablamos por aquí?', false)).toBeVisible({ timeout: 6000 });
    await tap(vis(page2, new RegExp(anaName)).last());
    await sleep(1000);
    await tapText(page2, 'Aceptar');
    await sleep(1200);
    expect(psql(`select status from conversations where id = '${convId}'`)).toBe('accepted');

    await page2.locator('textarea').filter({ visible: true }).last().fill('¡Hola! Claro, cuéntame.');
    await tapLabel(page2, 'Enviar');
    await sleep(1200);
    await expect(vis(page2, '¡Hola! Claro, cuéntame.', false)).toBeVisible({ timeout: 6000 });

    // ── Ana: vuelve a entrar y ve la respuesta; un mensaje con correo queda
    //         bloqueado (nunca llega a Beto) ────────────────────────────
    // Ana llegó a Chat vía perfil de Beto → MessageRequest (reemplazada por
    // Chat) — las dos pantallas raíz siguen apiladas sobre las pestañas
    // (mismo patrón que "bloquear con nombre" en community-social.spec.mjs):
    // hacen falta dos "Volver" para que la barra de pestañas vuelva a ser
    // alcanzable.
    await tapLabel(page, 'Volver');
    await sleep(400);
    await tapLabel(page, 'Volver');
    await sleep(500);
    await tapLabel(page, /^Comunidad/);
    await sleep(1000);
    await tapLabel(page, 'Mensajes');
    await sleep(1000);
    await tap(vis(page, new RegExp(betoName)).last());
    await sleep(1000);
    await expect(vis(page, '¡Hola! Claro, cuéntame.', false)).toBeVisible({ timeout: 6000 });

    // El filtro rechaza el envío con 400 a propósito (mensaje_no_entregado):
    // el fetch fallido deja un "Failed to load resource" en la consola que
    // aquí se espera, igual que un 401 forzado en otras pruebas.
    page.allowConsoleError(/400 \(Bad Request\)/);
    await page.locator('textarea').filter({ visible: true }).last().fill('Mejor escríbeme a prueba@correo.com');
    await tapLabel(page, 'Enviar');
    await sleep(1200);
    await expect(vis(page, 'No se entregó tu mensaje', false)).toBeVisible({ timeout: 6000 });
    expect(
      psql(`select count(*) from messages where conversation_id = '${convId}' and body like '%correo.com%'`)
    ).toBe('0');

    // ── Beto reporta un mensaje de Ana: crea un caso, sin decir quién reportó ─
    await tapLabel(page2, 'Reportar mensaje');
    await sleep(800);
    await tapText(page2, 'Acoso o falta de respeto');
    await sleep(300);
    await tapText(page2, 'Enviar reporte');
    await sleep(1000);
    await tapText(page2, 'Listo').catch(() => {});

    const reportRow = psql(
      `select reason from message_reports where conversation_id = '${convId}' and reporter_id = '${beto.id}'`
    );
    expect(reportRow).toBe('harassment');

    await ctx2.close();
  });
});
