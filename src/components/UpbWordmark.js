import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

// H2 de la auditoría (docs/auditoria/auditoria-app.md): el wordmark viejo era
// un único <Path> gigantesco, calcado de una fuente letra por letra, donde el
// contorno exterior y el hueco interior de la "U", la "P" y la "B" quedaron
// con el mismo sentido de giro — sin esa alternancia (regla par/impar del
// relleno SVG) los huecos de las letras no se recortan y el logo se ve como
// manchas superpuestas en vez de texto legible, justo lo que reportó la
// auditoría en Splash y Login.
//
// En vez de intentar corregir a mano un trazado de cientos de puntos, se
// rehace limpio con <Text> de react-native-svg: cada plataforma dibuja el
// glifo con su propio motor de fuentes (nunca se rompe un contorno a mano), y
// el degradado de marca UPB se aplica igual que antes vía <LinearGradient>.
export default function UpbWordmark({ size = 40, inverted = false }) {
  // Proporción ancho/alto fija (2.6:1) para que el wordmark ocupe un espacio
  // predecible en Splash/Login/Onboarding sin recortar la "B" final.
  const width = size * 2.6;
  return (
    <Svg viewBox="0 0 130 50" width={width} height={size} accessibilityLabel="UPB">
      <Defs>
        <LinearGradient id="upbGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={inverted ? '#fff' : '#FF003D'} />
          <Stop offset="100%" stopColor={inverted ? '#fff' : '#AD3DFF'} />
        </LinearGradient>
      </Defs>
      <SvgText
        x="65"
        y="38"
        textAnchor="middle"
        fontSize="38"
        fontWeight="bold"
        letterSpacing="2"
        fill="url(#upbGrad)"
      >
        UPB
      </SvgText>
    </Svg>
  );
}
