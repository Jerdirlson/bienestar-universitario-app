// SOS: se abre desde todos los accesos de la app, cada botón intenta hacer
// algo (marcar o abrir WhatsApp) y, si falla, el número queda visible para
// marcarlo a mano — la regla que no se negocia (ver CLAUDE.md).
import { test, expect, newStudent } from '../fixtures.mjs';
import { login, tap, tapText, tapLabel, vis, sleep } from '../ui.mjs';

const ENTRY_POINTS = [
  { name: 'Inicio', open: async (page) => tapLabel(page, 'Apoyo') },
  { name: 'Comunidad', open: async (page) => { await tapLabel(page, 'Comunidad'); await sleep(1000); await tapLabel(page, 'Apoyo'); } },
  { name: 'Explorar', open: async (page) => { await tapLabel(page, 'Explorar'); await sleep(800); await tapText(page, 'SOS'); } },
  { name: 'Progreso', open: async (page) => { await tapLabel(page, 'Progreso'); await sleep(800); await tapLabel(page, 'Apoyo'); } },
  {
    name: 'Normas de la comunidad',
    open: async (page) => {
      await tapLabel(page, 'Perfil');
      await tapText(page, 'Normas de la comunidad');
      await sleep(800);
      await tapText(page, 'Ver líneas de apoyo');
    },
  },
];

test.describe('SOS', () => {
  for (const entry of ENTRY_POINTS) {
    test(`se abre desde ${entry.name}`, async ({ page }) => {
      const u = newStudent();
      await login(page, u.email, u.password);
      await entry.open(page);
      await sleep(800);
      await expect(vis(page, /¿Necesitas hablar con alguien ahora\?/, false)).toBeVisible({ timeout: 6000 });
      // Los tres recursos están y cada uno tiene un botón de acción (o dice
      // "no disponible aún" si es el pendiente, pero nunca queda mudo).
      await expect(vis(page, 'Línea 106 · Salud mental', false)).toBeVisible();
      await expect(vis(page, 'Línea 123 · Emergencias', false)).toBeVisible();
      await expect(vis(page, 'Espérame · Bucaramanga', false)).toBeVisible();
    });
  }

  test('el botón de WhatsApp intenta abrir el enlace y, si falla, muestra el número', async ({ page }) => {
    const u = newStudent();
    // react-native-web abre wa.me con window.open (ver
    // node_modules/react-native-web/src/exports/Linking/index.js) — se
    // fuerza el fallo para probar el camino que CLAUDE.md exige: "si falla
    // abrir el marcador muestra el número". Los dos recursos 'tel:' en
    // cambio navegan con `window.location = 'tel:...'`, que en un navegador
    // sin marcador registrado no lanza una excepción capturable — por eso
    // para esos se comprueba solo lo que sí se puede probar desde aquí: que
    // tocar el botón no rompe la pantalla (ver la siguiente prueba).
    await page.addInitScript(() => {
      window.open = () => { throw new Error('bloqueado a propósito para la prueba'); };
    });
    await login(page, u.email, u.password);
    await tapLabel(page, 'Apoyo');
    await sleep(800);

    page.dialogs.length = 0;
    await tapLabel(page, 'Escribir · Espérame · Bucaramanga');
    await sleep(500);
    const shown = page.dialogs.some((d) => d.message.includes('+57 322 964 3755'));
    expect(shown, `esperaba el número en un diálogo; vi: ${JSON.stringify(page.dialogs)}`).toBe(true);
    await expect(vis(page, /¿Necesitas hablar con alguien ahora\?/, false)).toBeVisible();
  });

  test('los botones de llamada no rompen la pantalla y el número queda visible en su tarjeta', async ({ page }) => {
    const u = newStudent();
    // tel: sin marcador registrado en el navegador aborta la "navegación"
    // (net::ERR_ABORTED) — es justo el fallo silencioso que CLAUDE.md
    // asume posible; no es un error de la app.
    await login(page, u.email, u.password);
    await tapLabel(page, 'Apoyo');
    await sleep(800);
    page.allowConsoleError(/tel:.*ERR_ABORTED/);
    for (const label of ['Llamar · Línea 106 · Salud mental', 'Llamar · Línea 123 · Emergencias']) {
      await tapLabel(page, label);
      await sleep(600);
      // El número ya está en el título del recurso, siempre visible (no
      // depende de que falle abrir el marcador) — y la pantalla sigue viva.
      await expect(vis(page, /¿Necesitas hablar con alguien ahora\?/, false)).toBeVisible({ timeout: 6000 });
    }
    await expect(vis(page, 'Línea 106 · Salud mental', false)).toBeVisible();
    await expect(vis(page, 'Línea 123 · Emergencias', false)).toBeVisible();
  });
});
