// Configuración dinámica de Expo. Hasta el salto a SDK 57 esto era app.json
// estático; se convierte a JS porque `runtimeVersion` ahora necesita cambiar
// según para quién se publica:
//
//  - Por defecto (compilaciones nativas — APK/AAB, o builds de EAS): runtime
//    ligado a `expo.version` (política "appVersion"). El APK que ya está
//    instalado en el teléfono de prueba quedó fijo en runtime "1.0.0"; al
//    subir `version` a "1.1.0" en este salto de SDK, las actualizaciones OTA
//    nuevas (ya en SDK 57) dejan de llegarle a ese APK viejo a propósito —
//    mezclar código de un SDK distinto en un runtime que no lo espera lo
//    cerraría en vez de actualizarlo. Ver CLAUDE.md / README para instalar
//    un APK nuevo cuando se quiera probar SDK 57 nativo.
//  - Con la variable de entorno EXPO_GO=1 (la usa solo el paso que publica
//    hacia el canal `expo-go` en .github/workflows/deploy.yml): runtime
//    ligado al SDK de Expo (política "sdkVersion"). Expo Go no lee
//    `expo.version` — solo acepta actualizaciones publicadas con el runtime
//    `exposdk:<versión del SDK>` que trae instalado (aquí, "exposdk:57.0.0"),
//    así que sin este caso especial Expo Go nunca vería estas actualizaciones
//    y la app no abriría ahí (el motivo de este salto de SDK).
const fs = require('node:fs');
const path = require('node:path');

// google-services.json va en la raíz y NUNCA se versiona (.gitignore) — es la
// llave de Firebase/FCM del proyecto Android real, que el dueño descarga
// desde la consola de Firebase (ver deploy/README.md, "Notificaciones push
// en Android"). fs.existsSync evita que el build falle mientras ese archivo
// no exista todavía: sin él, android.googleServicesFile simplemente no se
// declara, y expo-notifications sigue funcionando para todo lo demás (solo
// falta el envío remoto real en Android nativo hasta que se suba la llave).
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const GOOGLE_SERVICES_EXISTS = fs.existsSync(path.resolve(__dirname, GOOGLE_SERVICES_JSON));

module.exports = {
  expo: {
    name: 'Raíz',
    slug: 'raiz-app',
    // 1.3.0: agrega expo-notifications, un módulo NATIVO nuevo. El APK 1.2.0
    // ya instalado quedó fijo en runtime "1.0.0" (ver la nota de más abajo)
    // y nunca recibe estas actualizaciones OTA — si las recibiera, llamaría a
    // un módulo nativo que ese binario no tiene y se cerraría. Subir la
    // versión aquí es lo que separa el runtime nuevo del viejo a propósito.
    version: '1.3.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'co.edu.upb.raiz',
    },
    android: {
      package: 'co.edu.upb.raiz',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      ...(GOOGLE_SERVICES_EXISTS ? { googleServicesFile: GOOGLE_SERVICES_JSON } : null),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-updates',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#F0E9FF',
        },
      ],
      'expo-status-bar',
      [
        'expo-notifications',
        {
          icon: './assets/adaptive-icon.png',
          color: '#6B4EFF',
        },
      ],
    ],
    updates: {
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 8000,
      url: 'https://u.expo.dev/a518bb81-fabb-445d-bd95-06279c5d3f0c',
    },
    runtimeVersion: process.env.EXPO_GO
      ? { policy: 'sdkVersion' }
      : { policy: 'appVersion' },
    extra: {
      eas: {
        projectId: 'a518bb81-fabb-445d-bd95-06279c5d3f0c',
      },
    },
    owner: 'jerdirlson',
  },
};
