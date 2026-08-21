/**
 * URL del API de Raíz. Viene de EXPO_PUBLIC_API_URL (ver .env.example) — sin
 * eso, la app no tiene con quién hablar y el login falla ruidoso al primer
 * intento, no en silencio.
 *
 * Hoy es la URL del túnel de Cloudflare del despliegue de prueba, que cambia
 * si el contenedor raiz-tunnel se reinicia. Ver deploy/docker-compose.yml.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? null;
