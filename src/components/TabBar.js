import React, { useEffect, useRef } from 'react';
import { View, Animated, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabActions } from '@react-navigation/native';
import { COLORS, RADIUS } from '../theme';
import { useSocial } from '../context/SocialContext';
import { useApp } from '../context/AppContext';
import useKeyboardVisible from './useKeyboardVisible';

const TAB_ICONS = {
  home: (active) => (
    <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <Path d="M3 10l8-7 8 7v8a2 2 0 01-2 2h-3v-6H8v6H5a2 2 0 01-2-2v-8z"
        stroke={COLORS.ink} strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  ),
  explore: (active) => (
    <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <Path d="M4 5c0-1 1-2 2-2h10c1 0 2 1 2 2v12c0 1-1 2-2 2H6c-1 0-2-1-2-2V5z"
        stroke={COLORS.ink} strokeWidth="1.8" />
      <Path d="M7 8h8M7 12h8M7 16h5" stroke={COLORS.ink} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  ),
  community: (active) => (
    <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <Path d="M4 5h14a1 1 0 011 1v9a1 1 0 01-1 1H9l-4 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z"
        stroke={COLORS.ink} strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  ),
  insights: (active) => (
    <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <Rect x="3.5" y="4.5" width="15" height="15" rx="3" stroke={COLORS.ink} strokeWidth="1.8" />
      <Path d="M3.5 8.5h15M7 3v3M15 3v3" stroke={COLORS.ink} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  ),
};

/**
 * `hidden` (opcional, lo calcula AppNavigator): true mientras un stack
 * anidado (check-in, retos) está en una subpantalla. Se suma a que el
 * teclado esté visible: en Android, edge-to-edge —obligatorio desde el
 * SDK 55 de Expo— hace que el sistema ya no redimensione la ventana al abrir
 * el teclado, así que esta
 * pastilla —posicionada absoluta al fondo— quedaba flotando encima del
 * teclado, tapando lo que se estaba escribiendo. Ambos casos se resuelven
 * igual: en vez de montar/desmontar de golpe (lo que se veía como un salto),
 * se funde con una animación corta.
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

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.wrapper,
        { paddingBottom: insets.bottom + 12 },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <View style={styles.pill}>
        {routes.map((route, index) => {
          const isFocused = state.index === index;
          const key = route.name.toLowerCase();
          const icon = TAB_ICONS[key];
          // Opcional: una pantalla puede fijar options.tabBarBadge con
          // navigation.setOptions (Comunidad lo usa para las no leídas).
          const badge = descriptors?.[route.key]?.options?.tabBarBadge
            ?? (key === 'community' && unread > 0 ? unread : null);

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                navigation.dispatch(TabActions.jumpTo(route.name));
              }}
              style={[styles.tab, isFocused && styles.tabActive]}
              activeOpacity={0.7}
              // Solo íconos en pantalla: el nombre de la pestaña va para lectores de
              // pantalla (antes los cuatro botones se anunciaban sin nombre).
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={badge ? `${t[key] ?? route.name} (${badge})` : (t[key] ?? route.name)}
            >
              {icon && icon(isFocused)}
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 9 ? '9+' : String(badge)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row', gap: 6, padding: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: RADIUS.pill,
    shadowColor: '#1A1523', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  tab: {
    width: 52, height: 44, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.55,
  },
  badge: {
    position: 'absolute', top: 4, right: 8, minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4, backgroundColor: COLORS.upbRed, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  tabActive: {
    backgroundColor: '#F0ECFA', opacity: 1,
  },
});
