// Acceso: onboarding, login (correcto, contraseña incorrecta, dominio no
// permitido), sesión persistente y vencida, cerrar sesión, cambio de idioma.
// Cada prueba crea su propia cuenta (db.mjs:makeAccount) — nada se comparte
// entre archivos ni depende del orden en que corran.
import { test, expect, newStudent } from '../fixtures.mjs';
import { APP_URL, login, tapText, tapLabel, vis, visLabel, bodyText, flat, sleep } from '../ui.mjs';
import { api, API_URL } from '../api.mjs';
import { dropAccount } from '../db.mjs';

// El onboarding nuevo (src/screens/OnboardingScreen.js) es un carrusel de 6
// pasos dentro de UNA sola pantalla: el botón "Siguiente"/"Empezar" del pie
// es único (no uno por paso como en el onboarding viejo, que apilaba una
// pantalla por cada `navigation.push`), así que un simple tapText en bucle
// alcanza — igual se deja el límite con margen por si el número de pasos
// vuelve a cambiar (src/lib/onboarding.js:TOTAL_STEPS).
async function passOnboarding(page) {
  for (let i = 0; i < 8; i++) {
    try { await tapText(page, /^(Siguiente|Empezar)$/i, { wait: 400 }); } catch { break; }
  }
}

test.describe('acceso', () => {
  test('onboarding: Siguiente hasta el final lleva a Login', async ({ page }) => {
    await page.goto(APP_URL);
    await sleep(1500);
    // Seis pasos de onboarding en este build (TOTAL_STEPS en
    // src/lib/onboarding.js): "Siguiente" x5 y luego "Empezar" (el último
    // botón cambia de texto — ver OnboardingScreen.js).
    await passOnboarding(page);
    await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible({ timeout: 8000 });
  });

  test('onboarding: no se repite si ya se completó una vez', async ({ page }) => {
    // src/lib/onboarding.js:decideSplashRoute — con la bandera puesta y sin
    // sesión, Splash va directo a Login. Se simula la bandera como la
    // guardaría completeOnboarding() en AppContext.js.
    await page.addInitScript(() => localStorage.setItem('raiz.onboarded.v1', '1'));
    await page.goto(APP_URL);
    await sleep(2500);
    await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible({ timeout: 8000 });
    await expect(vis(page, 'Saltar')).toHaveCount(0);
  });

  test('onboarding: Saltar lleva directo a Login', async ({ page }) => {
    await page.goto(APP_URL);
    await sleep(1500);
    await tapText(page, 'Saltar');
    await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible({ timeout: 8000 });
  });

  test('login correcto entra a la app', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await expect(vis(page, '¿Cómo va tu día?')).toBeVisible({ timeout: 8000 });
  });

  test('contraseña incorrecta muestra el aviso y no entra', async ({ page }) => {
    const u = newStudent();
    await page.goto(APP_URL);
    await sleep(1500);
    await passOnboarding(page);
    // El 401 de login-password es la respuesta esperada — el navegador lo
    // reporta solo por consola aunque la app lo maneje bien.
    page.allowConsoleError(/401/);
    const ins = page.locator('input').filter({ visible: true });
    await ins.nth(0).fill(u.email);
    await ins.nth(1).fill('esta-no-es-la-clave');
    await tapText(page, 'Entrar');
    await expect(vis(page, 'Correo o contraseña incorrectos.')).toBeVisible({ timeout: 6000 });
    // Sigue en la pantalla de login, no entró.
    await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible();
  });

  test('dominio no permitido lo rechaza el API', async () => {
    const r = await api('POST', '/auth/request-code', null, { email: 'alguien@gmail.com' }, { allowError: true });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('dominio_no_permitido');
  });

  test('dominio no permitido en la UI: no existe cuenta, mismo aviso sin crash', async ({ page }) => {
    // El login expuesto hoy es por contraseña (ver LoginScreen.js): un correo
    // fuera de la UPB simplemente no tiene cuenta, así que cae en el mismo
    // camino que una contraseña incorrecta — la app no distingue ni truena.
    await page.goto(APP_URL);
    await sleep(1500);
    await passOnboarding(page);
    page.allowConsoleError(/401/);
    const ins = page.locator('input').filter({ visible: true });
    await ins.nth(0).fill('alguien@gmail.com');
    await ins.nth(1).fill('lo-que-sea');
    await tapText(page, 'Entrar');
    await expect(vis(page, 'Correo o contraseña incorrectos.')).toBeVisible({ timeout: 6000 });
  });

  test('sesión persiste al recargar', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await expect(vis(page, '¿Cómo va tu día?')).toBeVisible({ timeout: 8000 });
    const tokenBefore = await page.evaluate(() => localStorage.getItem('raiz.session.v1'));
    expect(tokenBefore).toBeTruthy();
    await page.reload();
    await sleep(4000);
    // Sigue dentro: no aparece el formulario de login.
    await expect(vis(page, '¿Cómo va tu día?')).toBeVisible({ timeout: 8000 });
    const tokenAfter = await page.evaluate(() => localStorage.getItem('raiz.session.v1'));
    expect(tokenAfter).toBe(tokenBefore);
  });

  test('cuenta borrada: al recargar vuelve a Login con el aviso', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await expect(vis(page, '¿Cómo va tu día?')).toBeVisible({ timeout: 8000 });
    dropAccount(u.email);
    // El 401 de /auth/me al recargar es esperado a propósito en esta prueba.
    page.allowConsoleError(/401|sesion_invalida/);
    await page.reload();
    await sleep(6000);
    await expect(vis(page, 'Tu sesión venció. Vuelve a iniciar sesión.')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible();
  });

  test('cerrar sesión vuelve a Login y limpia el token', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Perfil');
    await tapText(page, 'Cerrar sesión');
    await sleep(2000);
    await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible({ timeout: 8000 });
    const token = await page.evaluate(() => localStorage.getItem('raiz.session.v1'));
    expect(token).toBeFalsy();
  });

  test('cambio de idioma es↔en en varias pantallas, sin "undefined"', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await expect(vis(page, '¿Cómo va tu día?')).toBeVisible({ timeout: 8000 });

    const badWords = /undefined|NaN|\[object Object\]|\{lang\}/;
    async function assertClean(label) {
      const txt = await bodyText(page);
      expect(txt, `${label}: texto sospechoso -> ${flat(txt, 2000)}`).not.toMatch(badWords);
    }

    await assertClean('home-es');
    await tapLabel(page, 'Perfil');
    await tapText(page, 'Idioma'); // alterna al tocar, sin submenú
    await sleep(800);
    await assertClean('profile-en');
    await tapLabel(page, 'Back');
    await assertClean('home-en');
    await tapLabel(page, 'Explore');
    await assertClean('explore-en');
    await tapLabel(page, 'Community');
    await sleep(1200);
    await assertClean('community-en');
    await tapLabel(page, 'Progress').catch(() => tapLabel(page, 'Insights'));
    await assertClean('insights-en');
    await tapLabel(page, 'Support').catch(() => tapText(page, 'SOS'));
    await assertClean('sos-en');
    // vuelve a español desde Perfil (por si el nombre de la pestaña cambió)
    await tapLabel(page, 'Back');
    await tapLabel(page, 'Profile');
    await tapText(page, 'Language');
    await sleep(800);
    await assertClean('profile-es-again');
  });
});
