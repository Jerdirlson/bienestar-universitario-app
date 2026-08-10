// Configuración de Metro basada en la de Expo, que añade la resolución de
// .ts/.tsx dentro de node_modules y los transformadores de assets.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
