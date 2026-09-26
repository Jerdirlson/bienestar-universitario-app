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
module.exports = {
  expo: {
    name: 'Raíz',
    slug: 'raiz-app',
    version: '1.1.0',
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
