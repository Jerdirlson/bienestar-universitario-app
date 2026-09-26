// Requerido por Metro. Expo SDK 57 envía sus paquetes como TypeScript
// (expo/package.json apunta a "src/Expo.ts"), así que sin babel-preset-expo el
// servidor de desarrollo no puede compilarlos y falla al resolver módulos.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
