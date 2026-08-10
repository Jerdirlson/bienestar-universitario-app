import { dayKey } from './dates.js';

/**
 * Días calendario consecutivos con al menos un check-in, contando hacia atrás
 * desde hoy.
 *
 * Si hoy todavía no hay registro la racha no se rompe: se sigue contando desde
 * ayer, porque el día aún no termina. Solo se corta cuando falta también ayer.
 *
 * Recibe entradas con `entryDate` ('AAAA-MM-DD', hora local). Trabajar sobre la
 * clave de día y no sobre marcas de tiempo evita que un check-in de las 11 p.m.
 * se cuente como del día siguiente al releerlo en otra zona horaria.
 */
export function computeStreak(entries, today = new Date()) {
  if (!entries || entries.length === 0) return 0;

  const days = new Set(entries.map(e => e.entryDate).filter(Boolean));
  if (days.size === 0) return 0;

  const cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
