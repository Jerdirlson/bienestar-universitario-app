import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Rect, Circle, Filter, FeGaussianBlur } from 'react-native-svg';

export default function RaizMark({ size = 120, glow = false }) {
  return (
    <Svg viewBox="0 0 120 120" width={size} height={size}>
      <Defs>
        <LinearGradient id="raizGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FF003D" />
          <Stop offset="100%" stopColor="#7A3FF0" />
        </LinearGradient>
      </Defs>
      {/* Squircle */}
      <Path d="M60 8 C 96 8, 112 24, 112 60 C 112 96, 96 112, 60 112 C 24 112, 8 96, 8 60 C 8 24, 24 8, 60 8 Z" fill="url(#raizGrad)" />
      {/* Stem */}
      <Rect x="42" y="32" width="8" height="58" rx="4" fill="#fff" />
      {/* Bowl of R */}
      <Path d="M50 32 L68 32 C 82 32, 82 54, 68 54 L50 54" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Leg of R */}
      <Path d="M64 54 L82 90" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Sprout */}
      <Path d="M46 32 Q 38 20, 30 22 Q 34 30, 46 32 Z" fill="#fff" fillOpacity="0.92" />
    </Svg>
  );
}
