/**
 * uuid v4 generado en el cliente, sin dependencias.
 *
 * El id de una entrada del diario libre lo pone el teléfono (ver api/API.md,
 * PUT /journal/:id) para poder crearla sin conexión y subirla después con el
 * mismo id: así un reintento nunca duplica la entrada.
 *
 * Usa crypto.getRandomValues cuando existe (Node, web). En Expo Go no siempre
 * está, y ahí basta Math.random: el id no es un secreto, solo tiene que no
 * repetirse, y con 122 bits aleatorios eso no pasa en la práctica.
 */

const defaultRandomBytes = (n) => {
  const bytes = new Uint8Array(n);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    try {
      c.getRandomValues(bytes);
      return bytes;
    } catch {
      // Algunos entornos exponen crypto sin implementación: seguimos abajo.
    }
  }
  for (let i = 0; i < n; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
};

export function uuidv4(randomBytes = defaultRandomBytes) {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // versión 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
