// Comunidad — publicar: anónimo, con alias (y la invitación a ponerse uno),
// texto con correo (revisión) y texto de crisis (aviso + botón a SOS); feed
// Para ti/Siguiendo, temas, búsqueda, populares y paginación.
import { test, expect, newStudent } from '../fixtures.mjs';
import { login, tap, tapText, tapLabel, vis, visLabel, bodyText, flat, sleep, card, marker } from '../ui.mjs';
import { api, apiLogin } from '../api.mjs';
import { psql } from '../db.mjs';

async function openCompose(page) {
  await tapLabel(page, 'Comunidad');
  await sleep(1200);
  await tapText(page, 'Comparte lo que sientes');
}
async function writeAndPublish(page, text) {
  await page.locator('textarea').filter({ visible: true }).last().fill(text);
  await tapText(page, 'Publicar');
  await sleep(1500);
}
function postsFor(email) {
  // status se queda en 'pending' para lo retenido — held_reason distingue
  // por qué ('crisis' | 'review' | 'reports'). Ver supabase/migrations/
  // 20260923000003_community_v2.sql.
  return psql(`select status, coalesce(held_reason,'-'), is_anonymous, topic, left(body,60) from posts p join auth.users u on u.id=p.author_id where u.email='${email}' order by p.created_at`);
}

test.describe('comunidad — publicar', () => {
  test('publicar anónimo con tema queda visible en el feed', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    const mk = marker('marca');
    await openCompose(page);
    await writeAndPublish(page, `Primera semana de parciales, agotada. ${mk}`);
    await expect(vis(page, mk, false)).toBeVisible({ timeout: 6000 });
    expect(postsFor(u.email)).toContain('published|-|t|');
  });

  test('publicar con alias: sin alias invita a ponerse uno, y luego publica con nombre', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await openCompose(page);
    await page.locator('textarea').filter({ visible: true }).last().fill('Quiero publicar con mi nombre.');
    await tapText(page, 'Con mi alias');
    await sleep(800);
    // Cae en Editar perfil, con el compose a la espera.
    await page.locator('input').filter({ visible: true }).first().fill('Alias E2E');
    await tapText(page, 'Guardar');
    await sleep(1200);
    // De vuelta en compose: ahora el selector Anónimo/Alias tiene el alias
    // como opción — hay que elegirlo (por defecto sigue en Anónimo).
    await tapText(page, 'Alias E2E');
    await sleep(400);
    await tapText(page, 'Publicar');
    await sleep(1500);
    const row = postsFor(u.email);
    expect(row).toContain('published|-|f|'); // is_anonymous = f: con nombre
  });

  test('texto con correo queda en revisión', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await openCompose(page);
    await writeAndPublish(page, 'Si alguien quiere estudiar conmigo, escríbame a persona@gmail.com');
    await expect(vis(page, 'Tu publicación está en revisión', false)).toBeVisible({ timeout: 6000 });
    const row = postsFor(u.email);
    expect(row).toMatch(/^pending\|review\|/);
  });

  test('texto de crisis muestra aviso y el botón lleva a SOS', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await openCompose(page);
    await writeAndPublish(page, 'Ya no aguanto más, quiero morir, no le veo sentido a nada.');
    await expect(vis(page, 'Hablar con alguien ahora', false)).toBeVisible({ timeout: 6000 });
    await tapText(page, 'Hablar con alguien ahora');
    await sleep(800);
    await expect(vis(page, /¿Necesitas hablar con alguien ahora\?/, false)).toBeVisible({ timeout: 4000 });
    const row = postsFor(u.email);
    expect(row).toMatch(/^pending\|crisis\|/);
  });

  test('feed Para ti / Siguiendo, y filtrar por tema', async ({ page }) => {
    const a = newStudent();
    await login(page, a.email, a.password);
    const mk = marker('tema');
    await openCompose(page);
    // writeAndPublish no elige tema: queda en 'general' (el que trae el
    // selector de temas del feed por defecto).
    await writeAndPublish(page, `Publicación de prueba de tema. ${mk}`);

    await expect(vis(page, 'Para ti')).toBeVisible();
    await tapText(page, 'Siguiendo');
    await sleep(1000);
    // Sin seguir a nadie con nombre todavía: el propio post anónimo no
    // debería listarse en "Siguiendo" (solo muestra publicaciones con
    // nombre de personas que se siguen).
    await expect(vis(page, mk, false)).not.toBeVisible();
    await tapText(page, 'Para ti');
    await sleep(800);
    await expect(vis(page, mk, false)).toBeVisible({ timeout: 6000 });

    // Filtrar por un tema distinto al de la publicación (general) la oculta,
    // y volver a "Todos" la vuelve a mostrar. (Antes esta prueba tocaba el
    // chip "Estudios" justo después de publicar sin objeto claro: el toque
    // recaía en el filtro del feed —no en el compose, ya cerrado— y dejaba el
    // filtro en "Estudios" sin resetearlo, escondiendo el post para siempre y
    // tumbando la aserción de más abajo.)
    await tapText(page, 'Estudios');
    await sleep(800);
    await expect(vis(page, mk, false)).not.toBeVisible();
    await tapText(page, 'Todos');
    await sleep(800);
    await expect(vis(page, mk, false)).toBeVisible({ timeout: 6000 });
  });

  test('buscar en la comunidad encuentra por palabra', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    const mk = marker('buscar');
    await openCompose(page);
    await writeAndPublish(page, `Contenido único para búsqueda ${mk}.`);
    await tapLabel(page, 'Comunidad');
    await sleep(1000);
    const search = page.locator('input').filter({ visible: true }).first();
    await search.fill(mk);
    await sleep(1200);
    await expect(vis(page, mk, false)).toBeVisible({ timeout: 6000 });
    await search.fill('esto-no-existe-nunca-jamas');
    await sleep(800);
    await expect(vis(page, mk, false)).not.toBeVisible();
  });

  test('populares pagina sin duplicar ni perder publicaciones', async ({ page }) => {
    const u = newStudent();
    const tok = await apiLogin(u.email, u.password);
    const prefix = `pag${marker()}`;
    for (let i = 0; i < 25; i++) {
      await api('POST', '/posts', tok, { body: `${prefix} #${String(i).padStart(2, '0')} texto de relleno`, topic: 'general', isAnonymous: true });
    }
    await login(page, u.email, u.password);
    await tapLabel(page, 'Comunidad');
    await sleep(1200);
    await tapText(page, 'Populares');
    await sleep(1200);
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => {
        for (const d of document.querySelectorAll('div')) {
          if (d.scrollHeight > d.clientHeight + 50 && d.offsetParent) d.scrollTop = d.scrollHeight;
        }
      });
      await sleep(500);
      if ((await bodyText(page)).includes('Estás al día')) break;
    }
    const txt = await bodyText(page);
    const seen = [...txt.matchAll(new RegExp(`${prefix} #(\\d\\d)`, 'g'))].map((m) => m[1]);
    expect(new Set(seen).size).toBe(seen.length); // sin duplicados
    expect(seen.length).toBeGreaterThanOrEqual(20); // recorrió varias páginas
  });
});
