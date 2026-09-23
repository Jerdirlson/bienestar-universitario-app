import { relativeParts } from '../../data/socialFormat';
import { errorMessageKey } from '../../data/socialCore';
import { COLORS } from '../../theme';

/** Completa {n}, {name}… en un texto de i18n. */
export function fmt(str, vars = {}) {
  return String(str ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

export const locale = (lang) => (lang === 'en' ? 'en-US' : 'es-CO');

export function timeAgo(iso, t, lang) {
  const { unit, value } = relativeParts(iso);
  if (unit === 'now') return t.socTimeNow;
  if (unit === 'm') return fmt(t.socTimeM, { n: value });
  if (unit === 'h') return fmt(t.socTimeH, { n: value });
  if (unit === 'd') return fmt(t.socTimeD, { n: value });
  return new Date(value).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short' });
}

export function monthYear(iso, lang) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(locale(lang), { month: 'long', year: 'numeric' });
}

/** Mensaje amable para cualquier error del API. */
export function errorText(error, t) {
  return t[errorMessageKey(error)] ?? t.socErrGeneric;
}

export const REACTION_EMOJI = { abrazo: '🤗', fuerza: '💪', te_entiendo: '🤝', inspira: '✨' };

export const AVATAR_EMOJIS = [
  '🌱', '🌿', '🍀', '🌸', '🌻', '🌷', '🌙', '⭐', '🌈', '🌊', '☀️', '🔥',
  '🦋', '🐢', '🐱', '🐶', '🦊', '🐼', '🐧', '🦉', '🍵', '📚', '🎧', '🎨',
];

/** Paleta del contrato → tonos de theme.js. */
export function avatarTone(color) {
  return COLORS.tones[color] ?? COLORS.tones.lilac;
}
