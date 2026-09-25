// Extiende @playwright/test con lo que casi toda prueba necesita: viewport
// de teléfono, captura de errores de consola (la prueba falla si aparece uno
// no esperado) y diálogos del navegador capturados en vez de bloquear la
// página (showAlert los usa en web — ver src/components/dialogs.js).
import { test as base, expect } from '@playwright/test';
import { makeAccount } from './db.mjs';

// Ruido conocido de la plataforma (no son errores de la app) — mismo filtro
// que traían los scripts de QA.
const NOISE = /Download the React DevTools|"shadow\*"|props\.pointerEvents|useNativeDriver|textShadow/;

export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') {
        const t = m.text();
        if (NOISE.test(t)) return;
        consoleErrors.push(`[${m.type()}] ${t.slice(0, 500)}`);
      }
    });
    page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));
    page.on('requestfailed', (r) => {
      consoleErrors.push(`[requestfailed] ${r.url()} — ${r.failure()?.errorText}`);
    });
    const dialogs = [];
    page.on('dialog', async (d) => {
      dialogs.push({ type: d.type(), message: d.message() });
      await d.accept().catch(() => {});
    });
    page.consoleErrors = consoleErrors;
    page.dialogs = dialogs;
    // Silencia un tipo de error puntual cuando la prueba lo espera a propósito
    // (por ejemplo, un 401 forzado al probar sesión vencida).
    page.allowConsoleError = (re) => { page.__allowedError = re; };

    await use(page);

    const allowed = page.__allowedError;
    const real = consoleErrors.filter((e) => !(allowed && allowed.test(e)));
    expect(real, `errores de consola inesperados en la página:\n${real.join('\n')}`).toEqual([]);
  },
});

export { expect };

/** Crea una cuenta de estudiante nueva y aislada para una prueba. */
export function newStudent(extra = {}) {
  return makeAccount({ prefix: 'stu', ...extra });
}
/** Crea una cuenta de administración nueva y aislada para una prueba. */
export function newAdmin(extra = {}) {
  return makeAccount({ prefix: 'adm', role: 'admin', ...extra });
}
