/**
 * Formato puro para la red social: tiempo relativo y agrupación por día.
 * Sin React Native, para probarlo en Node (tests/social*.test.mjs).
 */

/**
 * Tiempo transcurrido como { unit, value }: 'now' (< 1 min), 'm', 'h', 'd'
 * (< 7 días) o 'date' (más viejo: la pantalla muestra la fecha corta).
 */
export function relativeParts(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return { unit: 'now', value: 0 };
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return { unit: 'now', value: 0 };
  if (min < 60) return { unit: 'm', value: min };
  const hr = Math.floor(min / 60);
  if (hr < 24) return { unit: 'h', value: hr };
  const d = Math.floor(hr / 24);
  if (d < 7) return { unit: 'd', value: d };
  return { unit: 'date', value: then };
}

/** Clave de día local 'AAAA-MM-DD'. */
export function localDayKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Agrupa (en el orden recibido) por día local. Cada sección:
 * { key: 'today' | 'yesterday' | 'AAAA-MM-DD', date, items }.
 */
export function groupByDay(items, now = Date.now(), getDate = (x) => x.createdAt) {
  const today = localDayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = localDayKey(y);
  const sections = [];
  let current = null;
  for (const item of items) {
    const k = localDayKey(getDate(item));
    const key = k === today ? 'today' : k === yesterday ? 'yesterday' : k;
    if (!current || current.key !== key) {
      current = { key, date: getDate(item), items: [] };
      sections.push(current);
    }
    current.items.push(item);
  }
  return sections;
}
