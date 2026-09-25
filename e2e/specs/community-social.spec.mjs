// Comunidad — interacción: reacciones, guardados, comentarios (crear,
// responder, dar like), editar/borrar lo propio, reportes, bloqueos,
// perfil público y seguir, notificaciones, editar perfil y eliminar cuenta.
// Cada prueba crea sus propias cuentas.
import { test, expect, newStudent } from '../fixtures.mjs';
import { login, tap, tapText, tapLabel, tapIn, vis, visLabel, bodyText, flat, sleep, card, hittable, marker } from '../ui.mjs';
import { api, apiLogin, unreadCount } from '../api.mjs';
import { psql } from '../db.mjs';

async function setAlias(page, name) {
  await tapLabel(page, 'Perfil');
  await tapText(page, 'Ponte un alias').catch(() => tapText(page, 'Editar perfil'));
  await page.locator('input').filter({ visible: true }).first().fill(name);
  await tapText(page, 'Guardar');
  await sleep(1200);
  await tapLabel(page, 'Volver').catch(() => {});
}

async function publishNamed(tok, body) {
  const r = await api('POST', '/posts', tok, { body, isAnonymous: false, topic: 'general' });
  return r.body.post;
}
async function publishAnon(tok, body) {
  const r = await api('POST', '/posts', tok, { body, isAnonymous: true, topic: 'general' });
  return r.body.post;
}

test.describe('comunidad — reacciones y guardados', () => {
  test('las 4 reacciones, cambiar de una a otra y quitarla', async ({ page }) => {
    const author = newStudent();
    const tokA = await apiLogin(author.email, author.password);
    const mk = marker('react');
    const post = await publishAnon(tokA, `Post para reaccionar ${mk}`);

    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    const c = card(page, mk);
    for (const kind of ['Abrazo', 'Fuerza', 'Te entiendo', 'Me inspira']) {
      await tapIn(c, new RegExp(`^${kind} [0-9]+$`));
      await sleep(500);
      const row = psql(`select kind from post_reactions where post_id='${post.id}'`);
      const expectedKind = { Abrazo: 'abrazo', Fuerza: 'fuerza', 'Te entiendo': 'te_entiendo', 'Me inspira': 'inspira' }[kind];
      expect(row).toBe(expectedKind);
    }
    // Tocar la misma reacción otra vez la quita.
    await tapIn(c, /^Me inspira [0-9]+$/);
    await sleep(500);
    expect(psql(`select count(*) from post_reactions where post_id='${post.id}'`)).toBe('0');
  });

  test('guardar una publicación la muestra en Guardados', async ({ page }) => {
    const author = newStudent();
    const tokA = await apiLogin(author.email, author.password);
    const mk = marker('save');
    await publishAnon(tokA, `Post para guardar ${mk}`);

    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tapIn(card(page, mk), 'Guardar');
    await sleep(700);
    await tapLabel(page, 'Perfil');
    await tapText(page, 'Guardados');
    await sleep(1000);
    await expect(vis(page, mk, false)).toBeVisible({ timeout: 6000 });
  });
});

test.describe('comunidad — comentarios', () => {
  test('comentar, responder y dar like a un comentario', async ({ page, browser }) => {
    const author = newStudent();
    const tokA = await apiLogin(author.email, author.password);
    // publishNamed pide is_anonymous=false: el API exige un display_name ya
    // guardado (api/src/posts.js resolveAuthorName) y devuelve 400
    // 'falta_nombre' si no lo hay — como api() no lanza sobre errores HTTP,
    // el post nunca se creaba y la búsqueda de su marcador en el feed
    // colgaba hasta el timeout. Ver el mismo patrón en las otras pruebas que
    // usan publishNamed (bloquear con nombre, seguir).
    await api('PATCH', '/auth/profile', tokA, { displayName: `Autor${marker()}` });
    const mk = marker('comment');
    const post = await publishNamed(tokA, `Post con nombre para comentar ${mk}`);

    const b = newStudent();
    await login(page, b.email, b.password);
    await setAlias(page, 'Beto E2E');
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tap(vis(page, new RegExp(mk)).last());
    await sleep(1000);
    await page.locator('textarea, input').filter({ visible: true }).last().fill('Ánimo, mucha fuerza con eso.');
    await tapLabel(page, 'Enviar');
    await sleep(1200);
    await expect(vis(page, 'Ánimo, mucha fuerza con eso.', false)).toBeVisible({ timeout: 6000 });

    // El autor entra desde otro navegador, responde y le da like a su propio hilo de vuelta.
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page2 = await ctx2.newPage();
    await login(page2, author.email, author.password);
    // El comentario de B ya le dejó a author una notificación sin leer, así
    // que la pestaña trae el badge en la etiqueta ("Comunidad (1)" — ver
    // accessibilityLabel en src/components/TabBar.js). Con texto exacto
    // ('Comunidad' a secas) el locator no encontraba nada y colgaba hasta el
    // timeout; con el prefijo alcanza haya o no badge.
    await tapLabel(page2, /^Comunidad/);
    await sleep(1200);
    await tap(vis(page2, new RegExp(mk)).last());
    await sleep(1000);
    await tapText(page2, 'Responder');
    await page2.locator('textarea, input').filter({ visible: true }).last().fill('¡Gracias por el ánimo!');
    await tapLabel(page2, 'Enviar');
    await sleep(1200);
    // El botón "Me gusta" de cada comentario usa la misma etiqueta sin
    // distinguir cuál (src/screens/PostDetailScreen.js) — tapLabel a secas
    // tocaba el primero que encontraba (el comentario de B), no la respuesta
    // recién creada. Se acota al contenedor de la respuesta, igual que
    // "editar y borrar el propio comentario" acota "Opciones" a su tarjeta.
    const replyCard = page2.locator('div')
      .filter({ hasText: '¡Gracias por el ánimo!' })
      .filter({ has: page2.getByLabel('Me gusta') })
      .filter({ visible: true })
      .last();
    await tapIn(replyCard, 'Me gusta');
    await sleep(800);
    await ctx2.close();

    await sleep(1000);
    const rows = psql(`select c.parent_id is not null as reply, (select count(*) from comment_likes l where l.comment_id=c.id) from post_comments c where c.post_id='${post.id}' order by c.created_at`);
    expect(rows).toContain('t|1');
  });

  test('editar y borrar el propio comentario', async ({ page }) => {
    const author = newStudent();
    const tokA = await apiLogin(author.email, author.password);
    const mk = marker('editc');
    await publishAnon(tokA, `Post para editar comentario ${mk}`);

    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tap(vis(page, new RegExp(mk)).last());
    await sleep(1000);
    await page.locator('textarea, input').filter({ visible: true }).last().fill('Comentario original que luego edito.');
    await tapLabel(page, 'Enviar');
    await sleep(1200);
    await expect(vis(page, 'Comentario original que luego edito.', false)).toBeVisible();
    // borrar
    const c = page.locator('div').filter({ hasText: 'Comentario original que luego edito.' }).filter({ has: page.getByLabel('Opciones') }).filter({ visible: true }).last();
    await tapIn(c, 'Opciones');
    await tapText(page, 'Eliminar');
    await sleep(1200);
    await expect(vis(page, 'Comentario original que luego edito.', false)).not.toBeVisible();
  });
});

test.describe('comunidad — moderación desde la app', () => {
  test('editar y borrar la propia publicación', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await setAlias(page, 'Editable E2E');
    const mk = marker('edit');
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tapText(page, 'Comparte lo que sientes');
    await page.locator('textarea').filter({ visible: true }).last().fill(`Publicación editable ${mk}`);
    // El selector Anónimo/Alias arranca en Anónimo aunque ya haya alias —
    // hay que elegir el alias a propósito para publicar con nombre.
    await tapText(page, 'Editable E2E');
    await tapText(page, 'Publicar');
    await sleep(1500);

    const c = card(page, mk);
    await tapIn(c, 'Opciones');
    await tapText(page, 'Editar publicación');
    await sleep(800);
    await page.locator('textarea').filter({ visible: true }).last().fill(`Publicación editada ${mk}`);
    await tapText(page, 'Guardar cambios');
    await sleep(1500);
    await expect(vis(page, `Publicación editada ${mk}`, false)).toBeVisible({ timeout: 6000 });

    const c2 = card(page, mk);
    await tapIn(c2, 'Opciones');
    await tapText(page, 'Eliminar publicación');
    await sleep(1500);
    await expect(vis(page, `Publicación editada ${mk}`, false)).not.toBeVisible();
  });

  test('lo retenido por crisis no ofrece editar, solo borrar', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tapText(page, 'Comparte lo que sientes');
    await page.locator('textarea').filter({ visible: true }).last().fill('Ya no aguanto más, quiero morir.');
    await tapText(page, 'Publicar');
    await sleep(1500);
    await tapText(page, 'Ahora no').catch(() => {}); // cierra el aviso de crisis, no vamos a SOS aquí
    await sleep(500);
    await tapLabel(page, 'Perfil');
    await tapText(page, 'Mis publicaciones');
    await sleep(1000);
    const c = page.locator('div').filter({ hasText: 'Ya no aguanto más' }).filter({ has: page.getByLabel('Opciones') }).filter({ visible: true }).last();
    await tapIn(c, 'Opciones');
    await sleep(400);
    await expect(vis(page, 'Editar publicación')).not.toBeVisible();
    await expect(vis(page, 'Eliminar publicación')).toBeVisible();
  });

  test('reportar con 3 cuentas oculta la publicación y avisa al autor', async ({ page, browser }) => {
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const mk = marker('report');
    const post = await publishAnon(tokAuthor, `Compren mis cursos, promoción imperdible ${mk}`);

    const r1 = newStudent();
    const r2 = newStudent();
    const r3 = newStudent();
    for (const reporter of [r1, r2]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      await login(p, reporter.email, reporter.password);
      await tapLabel(p, 'Comunidad');
      await sleep(1200);
      await tapIn(card(p, mk), 'Opciones');
      await tapText(p, 'Reportar publicación');
      await sleep(500);
      await tapText(p, 'Spam o publicidad');
      await tapText(p, 'Enviar reporte');
      await sleep(1000);
      await ctx.close();
    }
    const tok3 = await apiLogin(r3.email, r3.password);
    await api('POST', `/posts/${post.id}/report`, tok3, { reason: 'spam' });
    await sleep(1000);
    // El 3er reporte no cambia status (sigue 'pending'): pone held_reason='reports'.
    expect(psql(`select status || '|' || held_reason from posts where id='${post.id}'`)).toBe('pending|reports');

    const notifs = (await api('GET', '/notifications', tokAuthor)).body.notifications.map((n) => n.kind);
    expect(notifs).toContain('post_hidden');
  });

  test('bloquear un anónimo oculta solo ese contenido; otro anónimo del mismo autor sigue visible', async ({ page }) => {
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const mkA = marker('blockA');
    const mkB = marker('blockB');
    await publishAnon(tokAuthor, `Primer post anónimo ${mkA}`);
    await publishAnon(tokAuthor, `Segundo post anónimo ${mkB}`);

    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tapIn(card(page, mkA), 'Opciones');
    await tapText(page, 'Bloquear a esta persona');
    await sleep(1500);
    const txt = await bodyText(page);
    expect(txt).not.toContain(mkA);
    expect(txt).toContain(mkB);
  });

  test('bloquear con nombre y desbloquear desde el perfil', async ({ page }) => {
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const aliasName = `ConNombre${marker()}`;
    await api('PATCH', '/auth/profile', tokAuthor, { displayName: aliasName });
    const me = (await api('GET', '/auth/me', tokAuthor)).body;
    const mk = marker('named');
    await publishNamed(tokAuthor, `Post con nombre para bloquear ${mk}`);

    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tap(vis(page, new RegExp(me.display_name)).last());
    await sleep(1200);
    await tapLabel(page, 'Opciones');
    await tapText(page, 'Bloquear a esta persona');
    await sleep(1200);
    await tapLabel(page, 'Volver').catch(() => {});
    await sleep(600);
    let txt = await bodyText(page);
    expect(txt).not.toContain(mk);

    await tapLabel(page, 'Perfil');
    await tapText(page, 'Personas bloqueadas');
    await sleep(1000);
    await tapText(page, 'Desbloquear');
    await sleep(1000);
    // Personas bloqueadas y Perfil son pantallas del stack raíz, apiladas
    // ENCIMA de las pestañas (ver src/navigation/AppNavigator.js): un solo
    // "Volver" solo saca de "Personas bloqueadas" a "Perfil", que sigue
    // tapando la barra de pestañas. Hace falta un segundo "Volver" para
    // salir del todo y que la pestaña "Comunidad" vuelva a ser alcanzable
    // (sin esto, tapLabel(page, 'Comunidad') agotaba el timeout esperándola).
    await tapLabel(page, 'Volver');
    await sleep(400);
    await tapLabel(page, 'Volver');
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    txt = await bodyText(page);
    expect(txt).toContain(mk);
  });
});

test.describe('comunidad — perfil, seguir y notificaciones', () => {
  test('perfil público, seguir y notificación al seguido', async ({ page }) => {
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const alias = `Publica${marker()}`;
    await api('PATCH', '/auth/profile', tokAuthor, { displayName: alias });
    await publishNamed(tokAuthor, 'Post con nombre para seguir.');

    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tap(vis(page, new RegExp(alias)).last());
    await sleep(1200);
    await tapText(page, 'Seguir');
    await sleep(1000);
    // getByRole en vez de texto: "Siguiendo" también aparece en la sección
    // "Para ti / Siguiendo" del feed de fondo.
    await expect(page.getByRole('button', { name: 'Siguiendo', exact: true }).filter({ visible: true })).toBeVisible({ timeout: 4000 });

    const notifs = (await api('GET', '/notifications', tokAuthor)).body.notifications.map((n) => n.kind);
    expect(notifs).toContain('new_follower');
  });

  test('notificaciones: llegan al otro, la reacción se ve como "Alguien", badge, campanita y marcar leídas', async ({ page }) => {
    const author = newStudent();
    await login(page, author.email, author.password);
    const mk = marker('notif');
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tapText(page, 'Comparte lo que sientes');
    await page.locator('textarea').filter({ visible: true }).last().fill(`Post para notificaciones ${mk}`);
    await tapText(page, 'Publicar');
    await sleep(1500);

    const post = JSON.parse(psql(`select json_build_object('id', id) from posts where body like '%${mk}%'`)).id;
    const reactor = newStudent();
    const tokReactor = await apiLogin(reactor.email, reactor.password);
    // 'hug' no es un kind válido — REACTION_KINDS (api/src/community.js) solo
    // acepta 'abrazo'|'fuerza'|'te_entiendo'|'inspira'. Con 'hug' el API
    // respondía 400 'reaccion_invalida' y, como api() no lanza sobre errores
    // HTTP, la reacción nunca se creaba: sin ella no hay notificación ni
    // badge que esperar, y la prueba se colgaba en esa aserción.
    await api('POST', `/posts/${post}/react`, tokReactor, { kind: 'abrazo' });
    await sleep(1500);

    await page.reload();
    await sleep(5000);
    await expect(page.getByLabel(/^Comunidad \(\d+\)$/).filter({ visible: true })).toBeVisible({ timeout: 8000 });
    await tapLabel(page, /^Comunidad/);
    await sleep(1000);
    await tapLabel(page, 'Notificaciones');
    await sleep(1200);
    await expect(vis(page, 'Alguien reaccionó a tu publicación', false)).toBeVisible({ timeout: 6000 });
    // tocar navega al detalle
    await tapText(page, 'Alguien reaccionó a tu publicación');
    await sleep(1200);
    await expect(vis(page, mk, false)).toBeVisible({ timeout: 6000 });
    await tapLabel(page, 'Volver');
    await sleep(600);
    await tapText(page, 'Marcar todo como leído').catch(() => {});
    await sleep(800);
    const labs = await page.evaluate(() => [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).filter((l) => /^Comunidad/.test(l)).join('|'));
    expect(labs).not.toMatch(/\(\d+\)/);
  });
});

test.describe('comunidad — perfil propio', () => {
  test('editar perfil: alias, bio, avatar y color', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Perfil');
    await tapText(page, 'Editar perfil');
    await sleep(600);
    await page.locator('input').filter({ visible: true }).first().fill('Perfil E2E');
    await page.locator('textarea').filter({ visible: true }).last().fill('Bio de prueba e2e.').catch(() => {});
    await tapLabel(page, 'Cielo').catch(() => {});
    await tapText(page, '🌻').catch(() => {});
    await tapText(page, 'Guardar');
    await sleep(1200);
    await expect(vis(page, 'Perfil E2E', false)).toBeVisible({ timeout: 6000 });
  });

  test('eliminar cuenta borra el perfil y su contenido del servidor', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    const tok = await apiLogin(u.email, u.password);
    await api('POST', '/posts', tok, { body: 'Post que debe desaparecer al borrar la cuenta.', isAnonymous: true });
    await sleep(800);
    await tapLabel(page, 'Perfil');
    await tapText(page, 'Eliminar cuenta', { nth: 0 });
    await sleep(600);
    const input = page.locator('input').filter({ visible: true }).last();
    await input.fill('ELIMINAR');
    await tapText(page, 'Eliminar mi cuenta para siempre');
    await sleep(3000);
    await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible({ timeout: 8000 });
    expect(psql(`select count(*) from auth.users where email='${u.email}'`)).toBe('0');
  });
});
