// Bienestar: Explorar (secciones, búsqueda), artículo con fuente, retos
// (unirse, registrar día, no dos veces, abandonar), respiración completa
// (suma al reto), 5-4-3-2-1, y que los logros reflejen datos reales.
import { test, expect, newStudent } from '../fixtures.mjs';
import { login, tap, tapText, tapLabel, vis, bodyText, sleep } from '../ui.mjs';
import { psql } from '../db.mjs';

function challengeRow(email, key) {
  return psql(`select p.completed_days, p.completed_at is not null
                 from user_challenges p
                 join challenges c on c.id = p.challenge_id
                 join auth.users u on u.id = p.user_id
                where u.email = '${email}' and c.key = '${key}'`);
}

test.describe('bienestar — explorar', () => {
  test('secciones de Explorar y búsqueda de artículos', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Explorar');
    await sleep(1000);
    await expect(vis(page, 'Ejercicios guiados')).toBeVisible({ timeout: 6000 });
    await expect(vis(page, 'Para leer')).toBeVisible();
    const search = page.locator('input').filter({ visible: true }).first();
    await search.fill('sueño');
    await sleep(800);
    await expect(vis(page, /dormir/i, false)).toBeVisible({ timeout: 6000 });
    await search.fill('esto-no-existe-jamas-xyz');
    await sleep(600);
    await expect(vis(page, /dormir/i, false)).not.toBeVisible();
  });

  test('un artículo muestra su fuente y abre el enlace externo', async ({ page }) => {
    const u = newStudent();
    await page.addInitScript(() => {
      window.__opened = [];
      window.open = (...a) => { window.__opened.push(a[0]); return null; };
    });
    await login(page, u.email, u.password);
    await tapLabel(page, 'Explorar');
    await sleep(1000);
    await tapText(page, 'Dormir mejor en época de clases').catch(async () => {
      // por si el título varía, se abre el primer artículo de la sección
      const card = page.locator('text=Para leer').locator('xpath=following::*[1]');
      await tap(card);
    });
    await sleep(800);
    await expect(vis(page, 'Fuentes')).toBeVisible({ timeout: 6000 });
    const sourceLink = page.getByRole('link').first();
    await tap(sourceLink);
    await sleep(500);
    const opened = await page.evaluate(() => window.__opened);
    expect(opened.length).toBeGreaterThan(0);
    expect(opened[0]).toMatch(/^https?:\/\//);
  });
});

test.describe('bienestar — retos', () => {
  test('unirse, registrar el día, no dos veces el mismo día, y abandonar', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Explorar');
    await sleep(800);
    await tapText(page, 'Ver retos');
    await sleep(1200);
    await tapText(page, 'Unirme');
    await sleep(1000);
    expect(challengeRow(u.email, 'breathing_7')).not.toBe('');

    await tapText(page, 'Registrar hoy');
    await sleep(1200);
    let row = challengeRow(u.email, 'breathing_7');
    expect(row.split('|')[0]).toBe('1');

    // Segunda vez el mismo día: no debe sumar de nuevo.
    await tapText(page, 'Registrar hoy').catch(() => {});
    await sleep(800);
    row = challengeRow(u.email, 'breathing_7');
    expect(row.split('|')[0]).toBe('1');
    // El botón muestra "✓ Hoy ya registrado" (con la marca de verificación).
    await expect(vis(page, 'Hoy ya registrado', false)).toBeVisible({ timeout: 4000 });

    await tapText(page, 'Abandonar');
    await sleep(1200);
    expect(challengeRow(u.email, 'breathing_7')).toBe('');
  });

  test('una sesión completa de respiración suma un día al reto', async ({ page }) => {
    test.setTimeout(150_000);
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Explorar');
    await sleep(800);
    await tapText(page, 'Ver retos');
    await sleep(1000);
    await tapText(page, 'Unirme');
    await sleep(1000);
    await tapLabel(page, 'Volver');
    await sleep(600);
    await tapText(page, 'Respiración guiada');
    await sleep(800);
    await tapText(page, /^1 min$/).catch(() => {});
    await tapText(page, 'Empezar');
    await sleep(2000);
    // La sesión de 1 minuto corre sola — se espera a que termine.
    await sleep(60_000);
    await expect(vis(page, 'Sumamos el día', false)).toBeVisible({ timeout: 15_000 });
    const row = challengeRow(u.email, 'breathing_7');
    expect(Number(row.split('|')[0])).toBeGreaterThanOrEqual(1);
  });
});

test.describe('bienestar — 5-4-3-2-1 y logros', () => {
  test('completar el ejercicio 5-4-3-2-1', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Explorar');
    await sleep(800);
    await tapText(page, '5-4-3-2-1');
    await sleep(800);
    await tapText(page, 'Empezar');
    for (let step = 0; step < 6; step++) {
      await sleep(400);
      const finished = await vis(page, 'Lo lograste').count();
      if (finished) break;
      await tap(vis(page, /^(Siguiente|Finalizar)$/i).last());
    }
    await expect(vis(page, 'Lo lograste')).toBeVisible({ timeout: 6000 });
  });

  test('los logros reflejan datos reales (no quedan en 0 tras registrar)', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, '¿Cómo va tu día?');
    await tapLabel(page, 'Bien'); await vis(page, 'Bien').last().click(); await sleep(500);
    await tapText(page, 'Motivado'); await tapText(page, 'Siguiente');
    await tapText(page, 'Estudios'); await tapText(page, 'Siguiente');
    await page.locator('textarea').filter({ visible: true }).fill('Para los logros.');
    await tapText(page, 'Finalizar'); await sleep(1200);
    await tapLabel(page, 'Cerrar'); await sleep(800);

    await tapLabel(page, 'Explorar');
    await sleep(800);
    await tapText(page, 'Ver retos');
    await sleep(1200);
    await expect(vis(page, 'Logros')).toBeVisible({ timeout: 6000 });
    const txt = await bodyText(page);
    expect(txt).not.toMatch(/undefined|NaN/);
    // Al menos un logro debe mostrar progreso "1/" o más (no todo en 0).
    expect(txt).toMatch(/[1-9]\d*\/\d+/);
  });
});
