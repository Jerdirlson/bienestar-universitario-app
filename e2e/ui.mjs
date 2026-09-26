// Ayudantes de interfaz, adaptados de los scripts de QA
// (%TEMP%/raiz-qa/lib.mjs) al framework @playwright/test. La app es React
// Native Web: los textos se comparan sin distinguir mayúsculas porque
// textTransform:uppercase hace que el DOM diga "Siguiente" y la pantalla
// "SIGUIENTE", y se prefiere accessibilityLabel (data-testid/aria-label)
// sobre el texto visible cuando puede haber ambigüedad.
export const APP_URL = process.env.E2E_APP_URL || 'http://localhost:8081';

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const rx = (text, exact = true) =>
  typeof text === 'string' ? new RegExp(exact ? `^\\s*${esc(text)}\\s*$` : esc(text), 'i') : text;

export const vis = (page, text, exact = true) => page.getByText(rx(text, exact)).filter({ visible: true });
export const visLabel = (page, label, exact = true) => page.getByLabel(rx(label, exact)).filter({ visible: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Marcador único para texto de prueba que va a publicarse (posts, comentarios,
// alias): NUNCA una racha larga de dígitos como Date.now() — el filtro de
// moderación (api/src/moderation.js) retiene cualquier texto con 7 dígitos
// seguidos por parecer un teléfono, y eso escondía el post del feed en vez
// de publicarlo. Base36 de pocos caracteres no puede juntar 7 dígitos.
export function marker(prefix = 'mk') {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

// Otras pestañas siguen montadas (tapadas) en el DOM: de varios candidatos,
// se usa el que de verdad recibiría el toque en su centro.
export async function hittable(loc) {
  const count = await loc.count();
  const out = [];
  for (let i = 0; i < count; i++) {
    const el = loc.nth(i);
    const ok = await el.evaluate((e) => {
      e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return Boolean(top && (e === top || e.contains(top) || top.contains(e)));
    }).catch(() => false);
    if (ok) out.push(el);
  }
  return out;
}

export async function tap(loc, opts = {}) {
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 10000 });
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(120);
  await loc.click({ timeout: opts.timeout ?? 10000 });
  await sleep(opts.wait ?? 400);
}

async function tapSmart(loc, opts) {
  await loc.first().waitFor({ state: 'visible', timeout: opts.timeout ?? 10000 });
  const c = await hittable(loc);
  const el = c[opts.nth ?? 0] ?? loc.nth(opts.nth ?? 0);
  return tap(el, opts);
}
export async function tapText(page, text, opts = {}) {
  return tapSmart(vis(page, text, opts.exact ?? true), opts);
}
export async function tapLabel(page, label, opts = {}) {
  return tapSmart(visLabel(page, label, opts.exact ?? true), opts);
}
export async function tapIn(scope, label, opts = {}) {
  const loc = scope.getByLabel(rx(label, opts.exact ?? true)).filter({ visible: true });
  const c = await hittable(loc);
  return tap(c[opts.nth ?? 0] ?? loc.first(), opts);
}

export async function bodyText(page) { return page.evaluate(() => document.body.innerText); }
export const flat = (s, n = 600) => (s ?? '').slice(0, n).replace(/\n/g, ' | ');

// Tarjeta de publicación: el contenedor más interno que trae el texto y una
// reacción (así no se confunde con el feed entero que también "contiene" el texto).
export function card(page, text) {
  return page.locator('div')
    .filter({ hasText: text })
    .filter({ has: page.getByLabel(/^(Abrazo|Hug) /) })
    .filter({ visible: true })
    .last();
}

/** Login por la UI (correo y contraseña), desde el arranque frío del onboarding. */
export async function login(page, email, password) {
  await page.goto(APP_URL);
  await sleep(2000);
  // El onboarding nuevo tiene 6 pasos (src/screens/OnboardingScreen.js,
  // src/lib/onboarding.js:TOTAL_STEPS): 5 toques en "Siguiente" y uno en
  // "Empezar". 12 intentos deja margen para la animación entre pasos (~320ms)
  // sin alargar mucho la prueba si algo va más lento de lo esperado.
  for (let i = 0; i < 12; i++) {
    const inputs = await page.locator('input').filter({ visible: true }).count();
    if (inputs >= 2) break;
    const btn = vis(page, /^(Siguiente|Next|Empezar|Start|Comenzar|Get started)$/i).first();
    if (await btn.count()) { await btn.click(); await sleep(400); } else await sleep(600);
  }
  const ins = page.locator('input').filter({ visible: true });
  await ins.nth(0).fill(email);
  await ins.nth(1).fill(password);
  await vis(page, /^(Iniciar sesión|Entrar|Log in|Sign in|Ingresar)$/i).first().click();
  await sleep(1800);
}

/** Instala en la página los ganchos que usan varias pruebas: idioma fijo (si
 * se pasa), y captura de window.open para no salir de la pestaña. */
export async function withHooks(page, { lang } = {}) {
  await page.addInitScript((l) => {
    if (l) localStorage.setItem('raiz.lang.v1', l);
    window.__opened = [];
    const realOpen = window.open?.bind(window);
    window.open = (...a) => { window.__opened.push(a[0]); return null; };
    window.__realOpen = realOpen;
  }, lang ?? null);
}
