import React from 'react';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';
import { COLORS } from '../theme';

export default function MoodFace({ level = 2, size = 56, bordered = false, muted = false }) {
  const color = muted ? '#D7D3E2' : COLORS.mood[level];

  const eyeProps = { stroke: '#1A1523', strokeWidth: 3, strokeLinecap: 'round', fill: 'none' };

  const eyes = [
    // awful
    (<>
      <Path d="M20 24 L32 30" {...eyeProps} />
      <Path d="M60 24 L48 30" {...eyeProps} />
    </>),
    // bad
    (<>
      <Path d="M22 28 Q28 24 34 28" {...eyeProps} />
      <Path d="M58 28 Q52 24 46 28" {...eyeProps} />
    </>),
    // okay
    (<>
      <Circle cx="28" cy="32" r="2.5" fill="#1A1523" />
      <Circle cx="52" cy="32" r="2.5" fill="#1A1523" />
    </>),
    // good
    (<>
      <Path d="M22 34 Q28 28 34 34" {...eyeProps} />
      <Path d="M46 34 Q52 28 58 34" {...eyeProps} />
    </>),
    // great
    (<>
      <Path d="M22 34 Q28 28 34 34" {...eyeProps} />
      <Path d="M46 34 Q52 28 58 34" {...eyeProps} />
    </>),
  ][level];

  const mouths = [
    <Path d="M26 54 Q40 46 54 54" stroke="#1A1523" strokeWidth="3" fill="none" strokeLinecap="round" />,
    <Path d="M28 52 Q40 48 52 52" stroke="#1A1523" strokeWidth="3" fill="none" strokeLinecap="round" />,
    <Path d="M28 50 L52 50" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />,
    <Path d="M26 46 Q40 56 54 46" stroke="#1A1523" strokeWidth="3" fill="none" strokeLinecap="round" />,
    (<>
      <Path d="M24 44 Q40 62 56 44" stroke="#1A1523" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M30 48 L50 48" stroke="#1A1523" strokeWidth="2" />
    </>),
  ][level];

  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r="36" fill={color} />
      <Ellipse cx="28" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.35)" />
      {eyes}
      {mouths}
      {bordered && <Circle cx="40" cy="40" r="37.5" fill="none" stroke={COLORS.ink} strokeWidth="2.5" />}
    </Svg>
  );
}
