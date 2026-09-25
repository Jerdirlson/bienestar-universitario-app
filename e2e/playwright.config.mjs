// Configuración de @playwright/test para la suite e2e de Raíz.
//
// - Viewport de teléfono (390x844): la app es mobile-first y así se prueba.
// - channel 'msedge' por defecto: usa el Edge ya instalado en Windows, sin
//   descargar un Chromium aparte (PW_CHANNEL='' para usar el que instale
//   `npx playwright install`, en una máquina sin Edge).
// - workers: 1 — las pruebas comparten un solo Postgres y un solo API con
//   límites de frecuencia; varias a la vez podrían pisarse (igual que
//   api/run-tests.sh corre con --test-concurrency=1 por la misma razón).
// - Sin reintentos: si algo es inestable se quiere ver, no esconderlo.
import { defineConfig, devices } from '@playwright/test';

const channel = process.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: './specs',
  timeout: 90_000,
  // Tope para la corrida entera: sin esto un hook trabado dejó una corrida
  // girando 4 horas. 61 pruebas caben de sobra en 30 minutos.
  globalTimeout: 30 * 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '.tmp/report' }]],
  outputDir: '.tmp/test-results',
  use: {
    ...devices['Desktop Chrome'],
    ...(channel ? { channel } : {}),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    headless: process.env.PW_HEADED ? false : true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'phone', use: {} }],
});
