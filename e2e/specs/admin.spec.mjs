// Panel de administración: login de admin, aprobar/rechazar lo retenido
// (con aviso al autor), reportes (descartar/quitar), quitar algo publicado,
// estadísticas, y que un estudiante no pueda entrar.
import { test, expect, newStudent, newAdmin } from '../fixtures.mjs';
import { sleep, marker } from '../ui.mjs';
import { api, apiLogin, API_URL } from '../api.mjs';
import { psql } from '../db.mjs';

const ADMIN_URL = process.env.E2E_ADMIN_URL || 'http://localhost:5173';

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

async function adminLogin(page, admin) {
  // admin-web/ no trae favicon.ico propio — el navegador lo pide solo y el
  // 404 queda en la consola sin que sea un fallo real de la app.
  page.allowConsoleError(/404/);
  await page.goto(ADMIN_URL);
  await page.click('summary');
  await page.fill('#apiUrl', API_URL);
  await page.fill('#email', admin.email);
  await page.fill('#password', admin.password);
  await page.click('#loginBtn');
  await sleep(1500);
}

test.describe('panel de administración', () => {
  test('login de admin entra al panel', async ({ page }) => {
    const admin = newAdmin();
    await adminLogin(page, admin);
    await expect(page.locator('#whoami')).toHaveText(admin.email, { timeout: 6000 });
    await expect(page.locator('#app')).toBeVisible();
  });

  test('un estudiante no puede entrar al panel', async ({ page }) => {
    const student = newStudent();
    await adminLogin(page, student);
    await expect(page.locator('#loginError')).toHaveText('Esta cuenta no es administradora.', { timeout: 6000 });
    await expect(page.locator('#app')).toBeHidden();
  });

  test('aprobar lo retenido lo publica y avisa al autor', async ({ page }) => {
    const admin = newAdmin();
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const mk = marker('crisis');
    const held = (await api('POST', '/posts', tokAuthor, { body: `Ya no aguanto más, quiero morir. ${mk}`, isAnonymous: true })).body.post;
    expect(held.moderation?.held_reason ?? held.status).toBeTruthy();

    await adminLogin(page, admin);
    const card = page.locator('.card', { hasText: mk });
    await expect(card).toBeVisible({ timeout: 6000 });
    // getByRole en vez de getByText: el cuerpo de la publicación no debe
    // poder confundirse con el botón así el marcador contenga la palabra.
    await card.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await sleep(1200);

    expect(psql(`select status from posts where id='${held.id}'`)).toBe('published');
    const notifs = (await api('GET', '/notifications', tokAuthor)).body.notifications.map((n) => n.kind);
    expect(notifs).toContain('post_approved');
  });

  test('rechazar deja el post rechazado y avisa al autor', async ({ page }) => {
    const admin = newAdmin();
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const mk = marker('tel');
    const held = (await api('POST', '/posts', tokAuthor, { body: `Mi número es 3001234567 llámenme ${mk}`, isAnonymous: true })).body.post;

    await adminLogin(page, admin);
    const card = page.locator('.card', { hasText: mk });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.getByRole('button', { name: 'Rechazar', exact: true }).click();
    await sleep(1200);

    expect(psql(`select status from posts where id='${held.id}'`)).toBe('rejected');
    const notifs = (await api('GET', '/notifications', tokAuthor)).body.notifications.map((n) => n.kind);
    expect(notifs).toContain('post_rejected');
  });

  test('reportes: descartar republica, quitar oculta para siempre', async ({ page }) => {
    const admin = newAdmin();
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const reporters = [newStudent(), newStudent(), newStudent()];

    const mkDismiss = marker('salva');
    const postDismiss = (await api('POST', '/posts', tokAuthor, { body: `Post que se salva ${mkDismiss}`, isAnonymous: true })).body.post;
    const mkRemove = marker('quita');
    const postRemove = (await api('POST', '/posts', tokAuthor, { body: `Post que se quita ${mkRemove}`, isAnonymous: true })).body.post;

    for (const post of [postDismiss, postRemove]) {
      for (const r of reporters) {
        const tok = await apiLogin(r.email, r.password);
        await api('POST', `/posts/${post.id}/report`, tok, { reason: 'spam' });
      }
    }
    expect(psql(`select held_reason from posts where id='${postDismiss.id}'`)).toBe('reports');

    await adminLogin(page, admin);
    await page.click('#navReports');
    await sleep(1000);

    const cardDismiss = page.locator('#reportsList .card', { hasText: mkDismiss });
    await expect(cardDismiss).toBeVisible({ timeout: 6000 });
    await cardDismiss.getByRole('button', { name: 'Descartar reportes', exact: true }).click();
    await sleep(1200);
    expect(psql(`select status, coalesce(held_reason,'-') from posts where id='${postDismiss.id}'`)).toBe('published|-');

    const cardRemove = page.locator('#reportsList .card', { hasText: mkRemove });
    await expect(cardRemove).toBeVisible({ timeout: 6000 });
    await cardRemove.getByRole('button', { name: 'Quitar', exact: true }).click();
    await sleep(1200);
    expect(psql(`select status from posts where id='${postRemove.id}'`)).toBe('removed');
  });

  test('quitar por id oculta una publicación ya publicada', async ({ page }) => {
    const admin = newAdmin();
    const author = newStudent();
    const tokAuthor = await apiLogin(author.email, author.password);
    const post = (await api('POST', '/posts', tokAuthor, { body: 'Post publicado que se quita por id.', isAnonymous: true })).body.post;
    expect(psql(`select status from posts where id='${post.id}'`)).toBe('published');

    await adminLogin(page, admin);
    // El campo "quitar por id" vive en la pestaña Reportes (#tabReports),
    // no en Moderación (la que abre por defecto) — sin este clic el input
    // sigue oculto (display:none) y el fill se queda esperando a que
    // "aparezca" hasta agotar el timeout.
    await page.click('#navReports');
    await sleep(500);
    await page.fill('#removePostId', post.id);
    await page.click('#removePostBtn');
    await sleep(1200);
    expect(psql(`select status from posts where id='${post.id}'`)).toBe('removed');
  });

  test('estadísticas muestra números reales', async ({ page }) => {
    const admin = newAdmin();
    await adminLogin(page, admin);
    await page.click('#navStats');
    await sleep(1200);
    const txt = await page.locator('#statsBox').innerText();
    expect(txt).toContain('Cuentas');
    expect(txt).toMatch(/\d/);
  });
});
