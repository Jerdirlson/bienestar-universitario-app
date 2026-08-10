import React from 'react';
import { View } from 'react-native';
import Svg, { G, Rect, Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { COLORS } from '../theme';

function mix(a, b, t) {
  const p = (h) => h.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16));
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  return `rgb(${Math.round(ar * (1 - t) + br * t)},${Math.round(ag * (1 - t) + bg * t)},${Math.round(ab * (1 - t) + bb * t)})`;
}

function illusKey(label) {
  const s = (label || '').toLowerCase();
  const map = [
    ['calend', 'calendario'], ['gratitud', 'gratitud'],
    ['libro', 'libro'], ['journal', 'libro'], ['diario', 'libro'],
    ['mañan', 'manana'], ['mornin', 'manana'], ['sun', 'manana'],
    ['estudio', 'estudios'], ['studi', 'estudios'], ['libros', 'estudios'],
    ['amig', 'amigos'], ['friend', 'amigos'],
    ['famil', 'familia'],
    ['parej', 'pareja'], ['partner', 'pareja'],
    ['ejerci', 'deporte'], ['exerc', 'deporte'], ['deport', 'deporte'], ['walk', 'deporte'],
    ['sueñ', 'descanso'], ['sleep', 'descanso'], ['descans', 'descanso'], ['dormir', 'descanso'],
    ['campus', 'campus'], ['univer', 'campus'],
    ['hobby', 'hobby'],
    ['red', 'redes'], ['social', 'redes'],
    ['comida', 'comida'], ['food', 'comida'],
    ['salud', 'salud'], ['health', 'salud'],
    ['dinero', 'dinero'], ['money', 'dinero'], ['$', 'dinero'],
    ['fuego', 'fuego'], ['racha', 'fuego'], ['streak', 'fuego'], ['🔥', 'fuego'],
    ['ansios', 'ansiedad'], ['ansiedad', 'ansiedad'], ['anxi', 'ansiedad'],
    ['positiv', 'positive'],
    ['relac', 'abrazo'], ['relation', 'abrazo'], ['fortal', 'abrazo'],
    ['neg', 'mente'], ['pensa', 'mente'], ['thought', 'mente'], ['reflect', 'mente'],
    ['decis', 'decision'], ['detox', 'detox'],
    ['mindful', 'mindful'], ['medit', 'mindful'], ['respir', 'mindful'], ['breath', 'mindful'],
  ];
  for (const [needle, key] of map) if (s.includes(needle)) return key;
  return 'default';
}

const ILLUS = {
  calendario: (c) => (
    <G>
      <Rect x="18" y="22" width="64" height="60" rx="6" fill={c.fg} />
      <Rect x="18" y="22" width="64" height="14" rx="6" fill={c.accent} />
      <Rect x="28" y="16" width="4" height="12" rx="2" fill={c.dark} />
      <Rect x="68" y="16" width="4" height="12" rx="2" fill={c.dark} />
      <Circle cx="35" cy="50" r="3" fill={c.dark} />
      <Circle cx="50" cy="50" r="3" fill={c.accent} />
      <Circle cx="65" cy="50" r="3" fill={c.dark} />
      <Circle cx="35" cy="65" r="3" fill={c.accent} />
      <Circle cx="50" cy="65" r="3" fill={c.dark} />
      <Circle cx="65" cy="65" r="3" fill={c.dark} />
    </G>
  ),
  gratitud: (c) => (
    <G>
      <Path d="M50 80 C28 68 22 52 30 42 Q42 32 50 46 Q58 32 70 42 C78 52 72 68 50 80z" fill={c.accent} />
      <Path d="M50 68 Q44 62 44 56 Q50 62 56 56 Q56 62 50 68z" fill={c.fg} fillOpacity="0.4" />
    </G>
  ),
  libro: (c) => (
    <G>
      <Path d="M20 28 Q50 22 80 28 L80 74 Q50 68 20 74 Z" fill={c.fg} />
      <Path d="M50 28 L50 74" stroke={c.accent} strokeWidth="2" />
      <Path d="M28 40 L45 38 M28 50 L45 48 M28 60 L45 58" stroke={c.accent} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M55 38 L72 40 M55 48 L72 50 M55 58 L72 60" stroke={c.accent} strokeWidth="1.5" strokeLinecap="round" />
    </G>
  ),
  manana: (c) => (
    <G>
      <Circle cx="50" cy="56" r="18" fill={c.accent} />
      <Path d="M50 30 L50 24 M72 56 L78 56 M28 56 L22 56 M66 40 L70 36 M34 40 L30 36" stroke={c.accent} strokeWidth="3" strokeLinecap="round" />
      <Path d="M20 74 L80 74" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
    </G>
  ),
  estudios: (c) => (
    <G>
      <Rect x="24" y="40" width="18" height="40" rx="2" fill={c.fg} />
      <Rect x="44" y="32" width="16" height="48" rx="2" fill={c.accent} />
      <Rect x="62" y="44" width="16" height="36" rx="2" fill={c.dark} />
    </G>
  ),
  amigos: (c) => (
    <G>
      <Circle cx="38" cy="38" r="10" fill={c.accent} />
      <Path d="M22 72 Q22 58 38 58 Q54 58 54 72 Z" fill={c.accent} />
      <Circle cx="62" cy="38" r="10" fill={c.dark} />
      <Path d="M46 72 Q46 58 62 58 Q78 58 78 72 Z" fill={c.dark} />
    </G>
  ),
  familia: (c) => (
    <G>
      <Path d="M50 78 C30 66 22 52 30 42 Q42 32 50 46 Q58 32 70 42 C78 52 70 66 50 78z" fill={c.accent} />
      <Circle cx="40" cy="52" r="4" fill={c.fg} />
      <Circle cx="60" cy="52" r="4" fill={c.fg} />
    </G>
  ),
  pareja: (c) => (
    <G>
      <Circle cx="38" cy="40" r="9" fill={c.accent} />
      <Circle cx="62" cy="40" r="9" fill={c.dark} />
      <Path d="M50 78 L42 64 Q42 58 50 58 Q58 58 58 64 Z" fill={c.accent} />
    </G>
  ),
  deporte: (c) => (
    <G>
      <Rect x="20" y="46" width="8" height="14" rx="2" fill={c.dark} />
      <Rect x="72" y="46" width="8" height="14" rx="2" fill={c.dark} />
      <Rect x="32" y="51" width="36" height="4" rx="2" fill={c.dark} />
      <Circle cx="36" cy="53" r="5" fill={c.accent} />
      <Circle cx="64" cy="53" r="5" fill={c.accent} />
    </G>
  ),
  descanso: (c) => (
    <G>
      <Path d="M30 60 Q30 40 50 40 Q72 40 70 60 Q68 66 56 66 Q42 66 30 60z" fill={c.accent} />
      <SvgText x="60" y="40" fontFamily="sans-serif" fontSize="14" fontWeight="900" fill={c.dark}>z</SvgText>
      <SvgText x="68" y="32" fontFamily="sans-serif" fontSize="11" fontWeight="900" fill={c.dark}>z</SvgText>
    </G>
  ),
  campus: (c) => (
    <G>
      <Path d="M20 72 L50 42 L80 72 Z" fill={c.accent} />
      <Rect x="38" y="58" width="24" height="14" fill={c.fg} />
      <Rect x="44" y="64" width="5" height="8" fill={c.dark} />
      <Rect x="52" y="64" width="5" height="8" fill={c.dark} />
    </G>
  ),
  hobby: (c) => (
    <G>
      <Rect x="26" y="36" width="48" height="34" rx="4" fill={c.fg} />
      <Circle cx="50" cy="53" r="10" fill={c.accent} />
      <Circle cx="50" cy="53" r="5" fill={c.dark} />
    </G>
  ),
  redes: (c) => (
    <G>
      <Circle cx="36" cy="36" r="12" fill={c.accent} />
      <Circle cx="64" cy="44" r="12" fill={c.dark} />
      <Rect x="30" y="56" width="24" height="20" rx="5" fill={c.fg} />
    </G>
  ),
  comida: (c) => (
    <G>
      <Circle cx="50" cy="54" r="24" fill={c.fg} />
      <Circle cx="50" cy="54" r="19" fill={c.accent} />
      <Circle cx="50" cy="54" r="7" fill="#F9C846" />
    </G>
  ),
  salud: (c) => (
    <G>
      <Path d="M50 78 C28 66 22 50 30 40 Q42 30 50 44 Q58 30 70 40 C78 50 72 66 50 78z" fill={c.accent} />
      <Path d="M44 50 L48 50 L48 44 L52 44 L52 50 L56 50 L56 54 L52 54 L52 60 L48 60 L48 54 L44 54 Z" fill={c.fg} />
    </G>
  ),
  dinero: (c) => (
    <G>
      <Rect x="20" y="38" width="60" height="32" rx="4" fill={c.accent} />
      <Circle cx="50" cy="54" r="9" fill={c.fg} />
      <SvgText x="50" y="59" textAnchor="middle" fontFamily="sans-serif" fontSize="14" fontWeight="900" fill={c.dark}>$</SvgText>
    </G>
  ),
  fuego: (c) => (
    <G>
      <Path d="M50 80 C32 76 28 62 36 52 Q40 58 44 54 Q42 40 50 28 Q54 42 60 48 Q66 54 66 62 C66 74 62 78 50 80z" fill={c.accent} />
      <Path d="M50 76 C42 74 40 66 44 60 Q48 66 50 60 Q52 66 54 62 Q58 68 54 74 Z" fill="#FFE29A" />
    </G>
  ),
  ansiedad: (c) => (
    <G>
      <Path d="M28 70 Q50 50 72 70" stroke={c.accent} strokeWidth="4" fill="none" strokeLinecap="round" />
      <Path d="M26 52 Q50 30 74 52" stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
      <Circle cx="50" cy="38" r="6" fill={c.accent} />
    </G>
  ),
  positive: (c) => (
    <G>
      <Circle cx="50" cy="50" r="26" fill={c.accent} />
      <Path d="M38 48 Q42 44 46 48 M54 48 Q58 44 62 48" stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M38 60 Q50 70 62 60" stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round" />
    </G>
  ),
  abrazo: (c) => (
    <G>
      <Circle cx="50" cy="40" r="10" fill={c.accent} />
      <Path d="M28 72 Q28 56 50 56 Q72 56 72 72 Z" fill={c.accent} />
      <Path d="M38 62 Q34 66 36 70 M62 62 Q66 66 64 70" stroke={c.fg} strokeWidth="3" fill="none" strokeLinecap="round" />
    </G>
  ),
  mente: (c) => (
    <G>
      <Circle cx="50" cy="50" r="24" fill={c.accent} />
      <Path d="M36 46 Q44 36 50 46 Q56 36 64 46 Q64 58 50 62 Q36 58 36 46z" fill={c.fg} />
      <Circle cx="44" cy="50" r="2" fill={c.dark} />
      <Circle cx="56" cy="50" r="2" fill={c.dark} />
    </G>
  ),
  decision: (c) => (
    <G>
      <Path d="M50 24 L50 56" stroke={c.dark} strokeWidth="3" strokeLinecap="round" />
      <Path d="M50 56 L32 74 M50 56 L68 74" stroke={c.dark} strokeWidth="3" strokeLinecap="round" />
      <Circle cx="50" cy="24" r="6" fill={c.accent} />
      <Circle cx="32" cy="74" r="6" fill={c.accent} />
      <Circle cx="68" cy="74" r="6" fill={c.dark} />
    </G>
  ),
  detox: (c) => (
    <G>
      <Rect x="34" y="28" width="32" height="48" rx="5" fill={c.dark} />
      <Rect x="38" y="34" width="24" height="34" rx="2" fill={c.accent} />
      <Path d="M32 30 L68 74" stroke={c.fg} strokeWidth="4" strokeLinecap="round" />
    </G>
  ),
  mindful: (c) => (
    <G>
      <Circle cx="50" cy="50" r="24" fill={c.accent} fillOpacity="0.4" />
      <Circle cx="50" cy="50" r="16" fill={c.accent} fillOpacity="0.6" />
      <Circle cx="50" cy="50" r="8" fill={c.dark} />
    </G>
  ),
  default: (c) => (
    <G>
      <Circle cx="50" cy="50" r="26" fill={c.accent} />
      <Circle cx="50" cy="50" r="14" fill={c.fg} />
    </G>
  ),
};

export default function IllusPlaceholder({ tone = 'lilac', label = '', size = 88, radius = 18, style = {} }) {
  const t = COLORS.tones[tone] || COLORS.tones.lilac;
  const palette = {
    bg: t.bg, fg: '#FFFFFF', accent: t.ink,
    dark: mix(t.ink, '#000000', 0.2),
  };
  const key = illusKey(label);
  const draw = ILLUS[key] || ILLUS.default;

  return (
    <View style={[{
      width: size, height: size, borderRadius: radius,
      backgroundColor: t.bg, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Svg viewBox="0 0 100 100" width={size} height={size}>
        {draw(palette)}
      </Svg>
    </View>
  );
}
