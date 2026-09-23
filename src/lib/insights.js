import { dayKey } from './dates.js';

/**
 * Estadísticas de Progreso, calculadas solo con los check-ins reales.
 * Ventanas móviles ("últimos 7 / 30 días") en hora local, contando hoy.
 * Sin datos, los promedios son null: la pantalla muestra un estado vacío en
 * vez de inventar un número.
 */

const shift = (date, delta) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + delta);
  return d;
};

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Un punto por día, del más antiguo a hoy: { date, mood } con mood null si no hubo registro. */
export function moodSeries(entries, days, today = new Date()) {
  const byDay = new Map((entries ?? []).map((e) => [e.entryDate, e.mood]));
  return Array.from({ length: days }, (_, i) => {
    const key = dayKey(shift(today, i - days + 1));
    return { date: key, mood: byDay.has(key) ? byDay.get(key) : null };
  });
}

/** Claves más frecuentes de `feelings` o `causes`: [{ k, count }], de más a menos. */
export function topKeys(entries, field, limit = 3) {
  const counts = new Map();
  for (const e of entries ?? []) {
    for (const k of e[field] ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts]
    .map(([k, count]) => ({ k, count }))
    .sort((a, b) => b.count - a.count || (a.k < b.k ? -1 : 1))
    .slice(0, limit);
}

export function entriesInWindow(entries, days, today = new Date(), offsetDays = 0) {
  const end = dayKey(shift(today, -offsetDays));
  const start = dayKey(shift(today, -offsetDays - days + 1));
  return (entries ?? []).filter((e) => e.entryDate >= start && e.entryDate <= end);
}

/**
 * Resumen de un periodo: registros, promedio de ánimo, comparación con el
 * periodo anterior del mismo largo, distribución y lo más frecuente.
 */
export function periodStats(entries, days, today = new Date()) {
  const current = entriesInWindow(entries, days, today);
  const previous = entriesInWindow(entries, days, today, days);
  const average = avg(current.map((e) => e.mood));
  const previousAverage = avg(previous.map((e) => e.mood));
  const distribution = [0, 0, 0, 0, 0];
  for (const e of current) if (Number.isInteger(e.mood) && e.mood >= 0 && e.mood <= 4) distribution[e.mood] += 1;
  return {
    days,
    count: current.length,
    average,
    previousAverage,
    delta: average != null && previousAverage != null ? average - previousAverage : null,
    distribution,
    series: moodSeries(entries, days, today),
    topFeelings: topKeys(current, 'feelings'),
    topCauses: topKeys(current, 'causes'),
  };
}

/** Racha más larga de días consecutivos con registro en todo el histórico. */
export function longestStreak(entries) {
  const days = [...new Set((entries ?? []).map((e) => e.entryDate).filter(Boolean))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    const [y, m, dd] = d.split('-').map(Number);
    const cur = new Date(y, m - 1, dd);
    run = prev && dayKey(shift(prev, 1)) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}
