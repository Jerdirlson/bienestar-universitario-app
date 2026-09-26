import React, { useEffect, useRef } from 'react';
import { View, Animated, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabActions } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import Icon from '../ui/Icon';
import { COLORS, SPACING, TYPE } from '../theme';
import { useSocial } from '../context/SocialContext';
import { useApp } from '../context/AppContext';
import useKeyboardVisible from './useKeyboardVisible';

// Ionicons por pestaña (§5 y §6): outline inactivo, relleno activo.
const TAB_ICONS = {
  home: { active: 'home', inactive: 'home-outline' },
  explore: { active: 'compass', inactive: 'compass-outline' },
  community: { active: 'people', inactive: 'people-outline' },
  insights: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

/**
 * Barra de pestañas estándar de iOS (§6): anclada abajo (no píldora
 * flotante), fondo translúcido con desenfoque en iOS (`expo-blur`) y blanco
 * con borde de 1 px en Android/web (ahí no hay `BlurView` nativo de verdad).
 *
 * `hidden` (opcional, lo calcula AppNavigator): true mientras un stack
 * anidado (check-in, retos) está en una subpantalla. Se suma a que el
 * teclado esté visible: en Android, edge-to-edge —obligatorio desde el
 * SDK 55 de Expo— hace que el sistema ya no redimensione la ventana al abrir
 * el teclado, así que esta barra, anclada al fondo, quedaba flotando encima
 * del teclado, tapando lo que se estaba escribiendo. Ambos casos se resuelven
 * igual: en vez de montar/desmontar de golpe (lo que se vería como un
 * salto), se funde con una animación corta.
 */
export default function TabBar({ state, descriptors, navigation, hidden: hiddenProp }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  // Las no leídas vienen del contexto social, que sondea desde que abre la
  // app: así el badge aparece aunque la pestaña Comunidad no se haya abierto.
  const { unread } = useSocial();
  const { t } = useApp();

  const keyboardVisible = useKeyboardVisible();
  const hidden = Boolean(hiddenProp) || keyboardVisible;
  const anim = useRef(new Animated.Value(hidden ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: hidden ? 0 : 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [hidden, anim]);

  // Solo iOS tiene un `BlurView` de verdad para el fondo translúcido del
  // §6; en Android/web se usa una vista blanca opaca con el borde superior
  // de `styles.bar`.
  const Background = Platform.OS === 'ios' ? BlurView : View;
  const backgroundExtraProps = Platform.OS === 'ios' ? { tint: 'light', intensity: 80 } : null;

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.wrapper,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <Background
        {...backgroundExtraProps}
        style={[
          styles.bar,
          Platform.OS !== 'ios' && styles.opaqueBg,
          { paddingBottom: insets.bottom || SPACING.sm },
        ]}
      >
        {routes.map((route, index) => {
          const isFocused = state.index === index;
          const key = route.name.toLowerCase();
          const icons = TAB_ICONS[key];
          // Opcional: una pantalla puede fijar options.tabBarBadge con
          // navigation.setOptions (Comunidad lo usa para las no leídas).
          const badge = descriptors?.[route.key]?.options?.tabBarBadge
            ?? (key === 'community' && unread > 0 ? unread : null);
          const label = t[key] ?? route.name;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                navigation.dispatch(TabActions.jumpTo(route.name));
              }}
              style={styles.tab}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={badge ? `${label} (${badge})` : label}
            >
              <View>
                {icons ? (
                  <Icon
                    name={isFocused ? icons.active : icons.inactive}
                    size={24}
                    color={isFocused ? COLORS.accent : COLORS.secondaryLabel}
                  />
                ) : null}
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 9 ? '9+' : String(badge)}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[TYPE.caption2, styles.label, { color: isFocused ? COLORS.accent : COLORS.secondaryLabel }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Background>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  bar: {
    flexDirection: 'row',
    paddingTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
    overflow: 'hidden',
  },
  // Android y web no tienen un BlurView nativo de verdad (§6): fondo blanco
  // opaco con el borde de 1 px de `bar` en vez de desenfoque.
  opaqueBg: { backgroundColor: COLORS.bgElevated },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 2,
  },
  label: { marginTop: 2 },
  badge: {
    position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4, backgroundColor: COLORS.destructive, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
