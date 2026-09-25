// Progreso: racha, vista semana/mes, y que el calendario refleje datos reales.
import { test, expect, newStudent } from '../fixtures.mjs';
import { login, tap, tapText, tapLabel, vis, bodyText, sleep } from '../ui.mjs';

// El número de racha y la etiqueta "días de racha" son nodos de texto
// separados (ver InsightsScreen.js) — no un solo string armado — así que se
// comparan sobre el innerText completo, no con un locator de un solo nodo.
async function expectStreak(page, n) {
  const txt = await bodyText(page);
  expect(txt).toMatch(new RegExp(`${n}\\s*\\n?\\s*días de racha`));
}

async function checkin(page, mood, feeling, cause, note) {
  await tapLabel(page, mood);
  await vis(page, mood).last().click();
  await sleep(500);
  await tapText(page, feeling);
  await tapText(page, 'Siguiente');
  await tapText(page, cause);
  await tapText(page, 'Siguiente');
  await page.locator('textarea').filter({ visible: true }).fill(note);
  await tapText(page, 'Finalizar');
  await sleep(1200);
  // Tras Finalizar aparece la pantalla resumen (racha, sugerencias) — hay que
  // cerrarla (X = "Cerrar") para volver a la navegación con pestañas.
  await tapLabel(page, 'Cerrar');
  await sleep(800);
}

test.describe('progreso', () => {
  test('la racha sube a 1 tras el check-in de hoy y aparece en Progreso', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Progreso');
    await sleep(800);
    await expect(vis(page, 'Registra hoy para empezar tu racha')).toBeVisible({ timeout: 6000 });

    await tapLabel(page, 'Inicio').catch(() => tapLabel(page, 'Home'));
    await tapText(page, '¿Cómo va tu día?');
    await checkin(page, 'Bien', 'Motivado', 'Estudios', 'Buen día para la racha.');

    await tapLabel(page, 'Progreso');
    await sleep(800);
    await expectStreak(page, 1);
  });

  test('registrar ayer desde el calendario sube la racha a 2', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, '¿Cómo va tu día?');
    await checkin(page, 'Bien', 'Tranquilo', 'Familia', 'Hoy registrado.');

    await tapLabel(page, 'Progreso');
    await sleep(800);
    const yesterday = new Date(Date.now() - 86400000).getDate();
    await tap(page.getByLabel(new RegExp(`^${yesterday}: Registrar este día$`)).filter({ visible: true }).first());
    await sleep(600);
    await checkin(page, 'Neutral', 'Esperanzado', 'Familia', 'Ayer registrado desde el calendario.');

    await tapLabel(page, 'Progreso');
    await sleep(800);
    await expectStreak(page, 2);
    // El día registrado ya no ofrece "Registrar este día": el calendario
    // muestra el ánimo real, no la invitación a registrar.
    await expect(page.getByLabel(new RegExp(`^${yesterday}: Registrar este día$`)).filter({ visible: true })).toHaveCount(0);
  });

  test('semana y mes cambian la vista sin romperse, y el calendario refleja lo registrado', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, '¿Cómo va tu día?');
    await checkin(page, 'Excelente', 'Feliz', 'Ejercicio', 'Nota para el calendario.');

    await tapLabel(page, 'Progreso');
    await sleep(800);
    await tapText(page, 'Semana');
    await sleep(600);
    await expect(vis(page, 'Semana')).toBeVisible();
    await tapText(page, 'Mes');
    await sleep(600);
    const today = new Date().getDate();
    // El día de hoy en el calendario ya no invita a "Registrar" — muestra el
    // ánimo elegido (Excelente).
    await expect(page.getByLabel(new RegExp(`^${today}: Excelente`)).filter({ visible: true }).first()).toBeVisible({ timeout: 6000 });
  });
});
