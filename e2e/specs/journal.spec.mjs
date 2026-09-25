// Diario: check-in de hoy y de un día pasado, diario libre con sus prompts
// guiados, privacidad entre cuentas y entre navegadores, tarjeta de crisis,
// sin red, y avisos al cerrar sesión con pendientes. Cada prueba crea su
// propia cuenta para poder correr en cualquier orden.
import { test, expect, newStudent } from '../fixtures.mjs';
import { APP_URL, login, tap, tapText, tapLabel, vis, visLabel, bodyText, flat, sleep } from '../ui.mjs';
import { psql } from '../db.mjs';
import { stopApi, startApi } from '../apiControl.mjs';

const entriesFor = (email) =>
  psql(`select e.entry_date::text, e.mood, e.feelings, e.causes, e.note
          from entries e join auth.users u on u.id = e.user_id
         where u.email = '${email}' order by e.entry_date`);

const journalFor = (email) =>
  psql(`select j.prompt_key, j.title, j.body, j.mood
          from journal_entries j join auth.users u on u.id = j.user_id
         where u.email = '${email}' order by j.created_at`);

test.describe('diario — check-in', () => {
  test('check-in completo de hoy: ánimo, emociones incl. difíciles, causas y nota', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, '¿Cómo va tu día?');
    await tapLabel(page, 'Bien');
    await vis(page, 'Bien').last().click();
    await sleep(500);
    // Una emoción "linda" y una "difícil" a la vez — el check-in lo permite.
    await tapText(page, 'Motivado');
    await tapText(page, 'Cansado');
    await tapText(page, 'Siguiente');
    await tapText(page, 'Estudios');
    await tapText(page, 'Siguiente');
    await page.locator('textarea').filter({ visible: true }).fill('Terminé el parcial, agotador pero valió la pena.');
    await tapText(page, 'Finalizar');
    await sleep(1200);
    // Tras Finalizar aparece el resumen de racha (sin el texto de la nota,
    // ver CheckinScreens.js:Checkin5Screen) — se cierra y se confirma en Inicio.
    await tapLabel(page, 'Cerrar');
    await sleep(800);
    await expect(vis(page, 'Ya registraste tu día')).toBeVisible({ timeout: 6000 });
    await expect(vis(page, 'Bien · ', false)).toBeVisible();

    await sleep(2500);
    const rows = entriesFor(u.email);
    expect(rows, 'debe haber exactamente una fila de hoy').not.toBe('');
    const [date, mood, feelings, causes, note] = rows.split('|');
    expect(mood).toBe('3'); // Bien = índice 3 de ['Muy mal','Mal','Neutral','Bien','Excelente']
    expect(feelings).toContain('motivado');
    expect(feelings).toContain('cansado');
    expect(causes).toContain('estudios');
    expect(note).toContain('Terminé el parcial');
  });

  test('editar el check-in de hoy actualiza la misma fila, no crea otra', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, '¿Cómo va tu día?');
    await tapLabel(page, 'Neutral'); await vis(page, 'Neutral').last().click(); await sleep(500);
    await tapText(page, 'Tranquilo'); await tapText(page, 'Siguiente');
    await tapText(page, 'Familia'); await tapText(page, 'Siguiente');
    await page.locator('textarea').filter({ visible: true }).fill('Primera versión de la nota.');
    await tapText(page, 'Finalizar'); await sleep(1200);
    await tapLabel(page, 'Cerrar'); await sleep(800);

    await tapText(page, 'Editar');
    await tapLabel(page, 'Excelente'); await vis(page, 'Excelente').last().click(); await sleep(500);
    await tapText(page, 'Agradecido'); await tapText(page, 'Siguiente');
    await tapText(page, 'Siguiente'); // causas ya marcadas, se conservan
    const ta = page.locator('textarea').filter({ visible: true });
    await ta.fill('Editado: me fue mejor de lo que pensaba.');
    await tapText(page, 'Finalizar'); await sleep(1200);

    await sleep(2500);
    const all = journalRowsCount(u.email, 'entries');
    expect(all).toBe(1);
    const [, mood, , , note] = entriesFor(u.email).split('|');
    expect(mood).toBe('4');
    expect(note).toContain('Editado: me fue mejor');
  });

  test('check-in de un día pasado desde el calendario, y volver a Progreso', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapLabel(page, 'Progreso');
    await sleep(800);
    await tap(page.getByLabel(/^10: Registrar este día$/).filter({ visible: true }).first());
    await sleep(600);
    await tapLabel(page, 'Mal'); await vis(page, 'Mal').last().click(); await sleep(500);
    await tapText(page, 'Triste'); await tapText(page, 'Siguiente');
    await tapText(page, 'Universidad').catch(() => tapText(page, 'Campus'));
    await tapText(page, 'Siguiente');
    await page.locator('textarea').filter({ visible: true }).fill('Día pesado, registrado tarde.');
    await tapText(page, 'Finalizar'); await sleep(1200);
    await tapLabel(page, 'Cerrar');
    await sleep(800);
    // Debe volver a Progreso, no quedarse en el check-in.
    await expect(vis(page, 'Progreso')).toBeVisible({ timeout: 6000 }).catch(async () => {
      // el título de la pantalla puede no calzar exacto con el de la pestaña; se
      // confirma por el calendario en su lugar.
      await expect(page.getByLabel(/^10: /).filter({ visible: true }).first()).toBeVisible();
    });

    await sleep(2500);
    const rows = entriesFor(u.email);
    expect(rows).toContain('Día pesado');
  });

  test('borrar un check-in lo quita de la base', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, '¿Cómo va tu día?');
    await tapLabel(page, 'Bien'); await vis(page, 'Bien').last().click(); await sleep(500);
    await tapText(page, 'Motivado'); await tapText(page, 'Siguiente');
    await tapText(page, 'Estudios'); await tapText(page, 'Siguiente');
    await page.locator('textarea').filter({ visible: true }).fill('Para borrar.');
    await tapText(page, 'Finalizar'); await sleep(1200);
    await tapLabel(page, 'Cerrar'); await sleep(800);
    await sleep(2000);
    expect(entriesFor(u.email)).not.toBe('');

    await tapLabel(page, 'Progreso');
    await sleep(600);
    const today = new Date().getDate();
    await tap(page.getByLabel(new RegExp(`^${today}: `)).filter({ visible: true }).first());
    await sleep(600);
    await tapText(page, 'Borrar');
    await sleep(1500);

    await sleep(2000);
    expect(entriesFor(u.email)).toBe('');
  });
});

function journalRowsCount(email, table) {
  return Number(psql(`select count(*) from ${table} e join auth.users u on u.id = e.user_id where u.email = '${email}'`));
}

test.describe('diario — diario libre', () => {
  test('crear una entrada con cada pregunta guiada', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    const prompts = ['Gratitud', 'Lo que me preocupa', 'Lo que me ayudó hoy', 'Carta para mí', 'Algo que hice bien', 'Escritura libre'];
    await tapText(page, 'Escribir');
    for (let i = 0; i < prompts.length; i++) {
      if (i > 0) {
        await tapLabel(page, 'Volver').catch(() => {});
        await tapText(page, 'Ver todo').catch(() => tapText(page, 'Nueva entrada'));
      }
      await tapText(page, prompts[i]);
      await visLabel(page, 'Título (opcional)').last().fill(`Entrada ${i + 1} ${prompts[i]}`);
      await visLabel(page, 'Escribe aquí…').last().fill(`Texto de la entrada ${i + 1}: palabraclave${i}`);
      await tapText(page, 'Guardar');
      await sleep(900);
    }
    await sleep(2500);
    expect(journalRowsCount(u.email, 'journal_entries')).toBe(prompts.length);
  });

  test('editar y borrar una entrada del diario libre', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, 'Escribir');
    await tapText(page, 'Escritura libre');
    await visLabel(page, 'Escribe aquí…').last().fill('Texto original.');
    await tapText(page, 'Guardar'); await sleep(900);

    // Editar
    const txt = await bodyText(page);
    if (!/Editar/i.test(txt)) await tapLabel(page, 'Volver').catch(() => {});
    await tapText(page, 'Editar').catch(async () => {
      await tapText(page, 'Ver todo');
      await tapText(page, /Texto original/, { exact: false });
      await tapText(page, 'Editar');
    });
    await visLabel(page, 'Escribe aquí…').last().fill('Texto editado.');
    await tapText(page, 'Guardar'); await sleep(900);
    await sleep(2000);
    expect(journalFor(u.email)).toContain('Texto editado');

    // Borrar
    await tapText(page, 'Borrar');
    await sleep(1200);
    await sleep(2000);
    expect(journalRowsCount(u.email, 'journal_entries')).toBe(0);
  });

  test('buscar en el diario libre encuentra por palabra clave', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, 'Escribir');
    await tapText(page, 'Gratitud');
    await visLabel(page, 'Escribe aquí…').last().fill('Agradecido por terminar el semestre xylofono42.');
    await tapText(page, 'Guardar'); await sleep(900);
    await tapLabel(page, 'Volver').catch(() => {});
    await tapText(page, 'Ver todo').catch(() => {});
    const search = visLabel(page, 'Buscar en tu diario').last();
    await search.fill('xylofono42');
    await sleep(800);
    await expect(vis(page, /xylofono42/, false)).toBeVisible({ timeout: 4000 });
    await search.fill('esto-no-existe-en-ningun-lado');
    await sleep(600);
    await expect(vis(page, /xylofono42/, false)).not.toBeVisible();
  });

  test('el borrador se recupera al volver a abrir "Escribir"', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, 'Escribir');
    await visLabel(page, 'Escribe aquí…').last().fill('Borrador que no guardé todavía.');
    await sleep(1000);
    await tapLabel(page, 'Volver');
    await sleep(600);
    await tapText(page, 'Escribir');
    await sleep(600);
    await expect(visLabel(page, 'Escribe aquí…').last()).toHaveValue('Borrador que no guardé todavía.');
    await tapText(page, 'Descartar').catch(() => {});
  });

  test('tarjeta de crisis al guardar texto de riesgo, y su botón abre SOS', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, 'Escribir');
    await tapText(page, 'Escritura libre');
    await visLabel(page, 'Escribe aquí…').last().fill('Ya no quiero seguir viviendo, no veo salida a esto.');
    await tapText(page, 'Guardar');
    await sleep(1200);
    await expect(vis(page, 'Ver apoyo ahora')).toBeVisible({ timeout: 6000 });
    await tapText(page, 'Ver apoyo ahora');
    await sleep(800);
    await expect(vis(page, /¿Necesitas hablar con alguien ahora\?/, false)).toBeVisible({ timeout: 4000 });
    // El texto se guarda igual — la detección es local, no censura al usuario.
    await sleep(2000);
    expect(journalFor(u.email)).toContain('Ya no quiero seguir viviendo');
  });
});

test.describe('diario — privacidad y sincronización', () => {
  test('otro navegador limpio con la misma cuenta ve todo', async ({ page, browser }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    await tapText(page, 'Escribir');
    await tapText(page, 'Escritura libre');
    await visLabel(page, 'Escribe aquí…').last().fill('Visible desde otro navegador.');
    await tapText(page, 'Guardar'); await sleep(1200);
    await sleep(2500); // dar tiempo a que sincronice con la cuenta

    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page2 = await ctx2.newPage();
    await login(page2, u.email, u.password);
    await tapText(page2, 'Ver todo').catch(() => {});
    await expect(vis(page2, 'Visible desde otro navegador.', false)).toBeVisible({ timeout: 8000 });
    await ctx2.close();
  });

  test('otra cuenta en el mismo navegador no ve nada ajeno', async ({ page }) => {
    const a = newStudent();
    const b = newStudent();
    await login(page, a.email, a.password);
    await tapText(page, 'Escribir');
    await tapText(page, 'Escritura libre');
    await visLabel(page, 'Escribe aquí…').last().fill('Secreto de la cuenta A, palabra-unica-9876.');
    await tapText(page, 'Guardar'); await sleep(1000);
    await sleep(2000);
    await tapLabel(page, 'Volver').catch(() => {});
    await tapLabel(page, 'Perfil');
    await tapText(page, 'Cerrar sesión');
    await sleep(1500);

    await login(page, b.email, b.password);
    await sleep(1000);
    const home = await bodyText(page);
    expect(home).not.toContain('palabra-unica-9876');
    await tapText(page, 'Escribir').catch(() => {});
    const listText = await bodyText(page);
    expect(listText).not.toContain('palabra-unica-9876');
  });

  test('sin red: guarda local y sincroniza al volver', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    stopApi();
    page.allowConsoleError(/Failed to load resource|net::|404|Failed to fetch/);
    try {
      await tapText(page, 'Escribir');
      await tapText(page, 'Escritura libre');
      await visLabel(page, 'Escribe aquí…').last().fill('Sin red: esto lo escribí sin conexión.');
      await tapText(page, 'Guardar');
      await sleep(1500);
      // Se guardó localmente: el detalle lo muestra aunque no haya red.
      await expect(vis(page, 'Sin red: esto lo escribí sin conexión.', false)).toBeVisible({ timeout: 6000 });
      expect(journalRowsCount(u.email, 'journal_entries')).toBe(0); // todavía no llegó al servidor
    } finally {
      expect(await startApi()).toBe(true);
    }
    await sleep(8000); // el motor de sincronización reintenta solo
    expect(journalFor(u.email)).toContain('Sin red: esto lo escribí sin conexión');
  });

  test('cerrar sesión con cambios pendientes avisa antes de salir', async ({ page }) => {
    const u = newStudent();
    await login(page, u.email, u.password);
    stopApi();
    page.allowConsoleError(/Failed to load resource|net::|404|Failed to fetch/);
    try {
      await tapText(page, 'Escribir');
      await tapText(page, 'Escritura libre');
      await visLabel(page, 'Escribe aquí…').last().fill('Pendiente de subir al cerrar sesión.');
      await tapText(page, 'Guardar'); await sleep(1000);
      await tapLabel(page, 'Volver').catch(() => {});
      await tapLabel(page, 'Perfil');
      await tapText(page, 'Cerrar sesión');
      await sleep(1500);
      // El aviso es un confirm() del navegador — queda registrado en page.dialogs
      // (el fixture lo acepta para no bloquear la corrida).
      const seen = page.dialogs.some((d) => /pendiente|sin sincronizar|sin subir/i.test(d.message));
      expect(seen, `dialogs vistos: ${JSON.stringify(page.dialogs)}`).toBe(true);
    } finally {
      await startApi();
    }
  });
});
