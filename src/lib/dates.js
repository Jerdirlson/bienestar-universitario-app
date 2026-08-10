/** Clave de día en hora local: 'AAAA-MM-DD'. Sirve para comparar días sin horas. */
export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Cuadrícula del mes en semanas que empiezan en lunes, para que calce con
 * el encabezado L M X J V S D. Las celdas vacías son null.
 */
export function buildMonthGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() devuelve 0 para domingo; lo corremos para que lunes sea 0.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 'agosto 2026' / 'August 2026', capitalizado. */
export function monthLabel(year, month, lang) {
  const label = new Date(year, month, 1).toLocaleDateString(
    lang === 'es' ? 'es-ES' : 'en-US',
    { month: 'long', year: 'numeric' }
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}
