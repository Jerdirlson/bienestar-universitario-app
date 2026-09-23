/**
 * Técnicas de respiración guiada. Lógica pura: la pantalla solo pregunta en
 * qué fase va según el tiempo transcurrido.
 *
 *  - slow: respiración lenta ~6 por minuto (5 s inhalar, 5 s exhalar). Es la
 *    que describe el NHS en "Breathing exercises for stress" (contar 1 a 5 al
 *    inhalar y al exhalar), https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/
 *  - box: caja 4-4-4-4.
 *  - 478: inhalar 4, sostener 7, exhalar 8.
 */

export const TECHNIQUES = [
  {
    id: 'slow',
    phases: [
      { kind: 'inhale', seconds: 5 },
      { kind: 'exhale', seconds: 5 },
    ],
  },
  {
    id: 'box',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'hold', seconds: 4 },
      { kind: 'exhale', seconds: 4 },
      { kind: 'holdOut', seconds: 4 },
    ],
  },
  {
    id: '478',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'hold', seconds: 7 },
      { kind: 'exhale', seconds: 8 },
    ],
  },
];

/** Duraciones que se pueden elegir, en minutos. */
export const DURATIONS = [1, 3, 5];

export const getTechnique = (id) => TECHNIQUES.find(t => t.id === id) ?? TECHNIQUES[0];

export const cycleMs = (technique) =>
  technique.phases.reduce((s, p) => s + p.seconds * 1000, 0);

/** Respiraciones por minuto de la técnica. */
export const breathsPerMinute = (technique) => 60000 / cycleMs(technique);

/**
 * Duración real de la sesión: los minutos elegidos redondeados hacia arriba a
 * ciclos completos, para no cortar a mitad de una exhalación.
 */
export function sessionLengthMs(technique, minutes) {
  const c = cycleMs(technique);
  return Math.max(1, Math.ceil((minutes * 60000) / c)) * c;
}

/**
 * Fase en curso para un tiempo transcurrido.
 * → { index, kind, cycle, phaseMs, remainingMs, done }
 */
export function phaseAt(technique, elapsedMs, totalMs = Infinity) {
  if (elapsedMs >= totalMs) {
    return { index: -1, kind: 'done', cycle: -1, phaseMs: 0, remainingMs: 0, done: true };
  }
  const c = cycleMs(technique);
  const t = Math.max(0, elapsedMs);
  const cycle = Math.floor(t / c);
  let inCycle = t - cycle * c;
  for (let i = 0; i < technique.phases.length; i++) {
    const phaseMs = technique.phases[i].seconds * 1000;
    if (inCycle < phaseMs) {
      return {
        index: i,
        kind: technique.phases[i].kind,
        cycle,
        phaseMs,
        remainingMs: phaseMs - inCycle,
        done: false,
      };
    }
    inCycle -= phaseMs;
  }
  // No debería pasar (inCycle < c), pero por si acaso: inicio del siguiente ciclo.
  return { index: 0, kind: technique.phases[0].kind, cycle: cycle + 1, phaseMs: technique.phases[0].seconds * 1000, remainingMs: technique.phases[0].seconds * 1000, done: false };
}

/** Escala del círculo al final de cada fase (inhalar crece, exhalar encoge). */
export function phaseTargetScale(kind, { min = 0.55, max = 1 } = {}) {
  if (kind === 'inhale') return max;
  if (kind === 'exhale') return min;
  return null; // sostener: se queda donde está
}
