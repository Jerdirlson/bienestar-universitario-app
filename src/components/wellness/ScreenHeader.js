import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Text } from '../../ui';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING } from '../../theme';

// Ancho fijo de cada "lado" de la barra estándar, igual al tamaño del icono
// de "atrás" con su margen: así el título queda centrado de verdad aunque
// solo un lado tenga contenido (si no, un `right` ausente lo desplazaría).
const SIDE = 44;

/**
 * Encabezado estilo Apple (docs/design-system.md §5-§6) para el área de
 * Acceso y Bienestar. `AppNavigator.js` mantiene `headerShown: false` en
 * todos los stacks (no es parte de este rediseño), así que cada pantalla
 * sigue dibujando su propia barra — pero con la composición que pide el
 * sistema de diseño en vez de la barra vieja (`src/components/TopBar.js`,
 * compartida con las pantallas de otros dos rediseños y por eso fuera de
 * alcance aquí):
 *
 *  - `large`: título grande a la izquierda, para la raíz de una pestaña
 *    (Explorar) — imita `headerLargeTitle` de iOS.
 *  - detalle (por defecto): barra estándar con título centrado y una flecha
 *    "atrás" que reemplaza al texto en mayúsculas de la barra anterior.
 */
export default function ScreenHeader({ title, onBack, large = false, right = null, testID }) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();

  if (large) {
    return (
      <View style={[styles.bar, { paddingTop: insets.top + SPACING.sm }]} testID={testID}>
        <View style={styles.largeRow}>
          <Text variant="largeTitle" numberOfLines={1} style={styles.largeTitle}>{title}</Text>
          {right}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bar, { paddingTop: insets.top + SPACING.sm }]} testID={testID}>
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t.diaryBack}
              style={styles.backBtn}
            >
              <Icon name="chevron-back" size={26} color={COLORS.accent} />
            </Pressable>
          ) : null}
        </View>
        <Text variant="headline" numberOfLines={1} style={styles.title}>{title}</Text>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  side: { width: SIDE, alignItems: 'flex-start', justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  title: { flex: 1, textAlign: 'center', color: COLORS.label },
  largeRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
  },
  largeTitle: { color: COLORS.label },
});
