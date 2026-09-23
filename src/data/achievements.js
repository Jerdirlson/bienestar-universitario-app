import { dayKey } from '../lib/dates.js';

/**
 * Logros calculados SOLO con datos reales: check-ins guardados, racha,
 * retos terminados y ejercicios registrados. Nada se desbloquea "de regalo".
 */

const entryDay = (e) => e?.entryDate ?? e?.entry_date ?? null;

/** Racha más larga de días consecutivos con check-in en todo el histórico. */
export function longestStreak(entries = []) {
  const days = [...new Set(entries.map(entryDay).filter(Boolean))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    if (prev) {
      const [y, m, dd] = prev.split('-').map(Number);
      const next = dayKey(new Date(y, m - 1, dd + 1));
      run = next === d ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export const ACHIEVEMENTS = [
  { id: 'first_checkin', metric: 'entries', target: 1 },
  { id: 'entries_30', metric: 'entries', target: 30 },
  { id: 'streak_7', metric: 'bestStreak', target: 7 },
  { id: 'streak_30', metric: 'bestStreak', target: 30 },
  { id: 'first_exercise', metric: 'exercises', target: 1 },
  { id: 'exercises_10', metric: 'exercises', target: 10 },
  { id: 'first_challenge', metric: 'challenges', target: 1 },
  { id: 'challenges_3', metric: 'challenges', target: 3 },
];

/**
 * @param {object} data
 * @param {number} [data.streak]     racha actual (AppContext)
 * @param {Array}  [data.entries]    check-ins (entryDate o entry_date)
 * @param {Array}  [data.challenges] retos con la forma del contrato
 * @param {Array}  [data.exercises]  registros de exercises.js
 */
export function computeAchievements({ streak = 0, entries = [], challenges = [], exercises = [] } = {}) {
  const metrics = {
    entries: new Set(entries.map(entryDay).filter(Boolean)).size,
    bestStreak: Math.max(Number(streak) || 0, longestStreak(entries)),
    exercises: exercises.length,
    challenges: challenges.filter(c => c.completed_at).length,
  };
  return ACHIEVEMENTS.map(a => {
    const current = metrics[a.metric];
    return {
      id: a.id,
      target: a.target,
      current: Math.min(current, a.target),
      unlocked: current >= a.target,
    };
  });
}
