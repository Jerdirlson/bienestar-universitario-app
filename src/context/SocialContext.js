import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './AppContext';
import { socialApi } from '../data/socialApi';
import { normalizeMe } from '../data/socialCore';
import { COLORS, FONTS } from '../theme';

/**
 * Estado compartido de la red social:
 *
 * - `apiVersion`: 1 | 2 | null. Se toma de AppContext si lo expone; si no, se
 *   descubre con GET /meta. Con 1 las pantallas ocultan lo que v1 no tiene.
 * - `me`: mi perfil normalizado (public_id, alias, avatar, bio). Se toma de
 *   `profile` de AppContext si existe; si no, se pide /auth/me aquí.
 * - `unread`: notificaciones sin leer, sondeando cada 60 s mientras la app
 *   está activa.
 * - Un bus de eventos pequeño (`emit` / `subscribe`) para que una acción en
 *   una pantalla (reaccionar en el detalle, publicar, bloquear) se refleje en
 *   las listas de otras sin recargar todo.
 * - `showToast(msg)`: aviso breve, no bloqueante.
 */

const POLL_MS = 60000;

const SocialContext = createContext(null);

export function SocialProvider({ children }) {
  const app = useApp() ?? {};
  const token = app.sessionToken ?? null;
  const appHasProfile = app.profile !== undefined;
  const appVersion = app.apiVersion === 1 || app.apiVersion === 2 ? app.apiVersion : null;

  const [ownVersion, setOwnVersion] = useState(null);
  const [ownMe, setOwnMe] = useState(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);

  const apiVersion = appVersion ?? ownVersion;

  // La versión la usa también el cliente de datos para degradar a v1.
  useEffect(() => {
    if (appVersion) { socialApi.setApiVersion(appVersion); return; }
    let cancelled = false;
    socialApi.getMeta().then(v => { if (!cancelled && v) setOwnVersion(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [appVersion, token]);

  const reloadMe = useCallback(async () => {
    if (!token || appHasProfile) return;
    try { setOwnMe(await socialApi.getMe(token)); } catch { /* AppContext ya maneja la sesión inválida */ }
  }, [token, appHasProfile]);

  useEffect(() => {
    if (!token) { setOwnMe(null); setUnread(0); return; }
    reloadMe();
  }, [token, reloadMe]);

  const me = useMemo(() => {
    if (appHasProfile) return normalizeMe(app.profile);
    if (ownMe) return ownMe;
    // Mientras tanto, lo mínimo que AppContext ya conoce.
    return token ? normalizeMe({ display_name: app.userName ?? null, email: app.userEmail ?? null, created_at: app.memberSince ?? null }) : null;
  }, [appHasProfile, app.profile, ownMe, token, app.userName, app.userEmail, app.memberSince]);

  /** Tras editar el perfil: recarga en AppContext y aquí. */
  const refreshMe = useCallback(async () => {
    await Promise.all([
      app.refreshProfile ? app.refreshProfile().catch(() => {}) : Promise.resolve(),
      reloadMe(),
    ]);
  }, [app.refreshProfile, reloadMe]);

  // ── no leídas ──
  const refreshUnread = useCallback(async () => {
    if (!token || apiVersion === 1) { setUnread(0); return; }
    try { setUnread(await socialApi.unreadCount(token)); } catch { /* sin red: conserva el último */ }
  }, [token, apiVersion]);

  useEffect(() => {
    if (!token || apiVersion === 1) return undefined;
    let timer = null;
    const start = () => {
      if (timer) return;
      refreshUnread();
      timer = setInterval(refreshUnread, POLL_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    if (AppState.currentState === 'active' || AppState.currentState == null) start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [token, apiVersion, refreshUnread]);

  // ── bus de eventos ──
  const listeners = useRef(new Set());
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);
  const emit = useCallback((event) => {
    for (const fn of [...listeners.current]) {
      try { fn(event); } catch { /* un oyente roto no rompe a los demás */ }
    }
  }, []);

  // ── aviso breve ──
  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const value = useMemo(() => ({
    apiVersion,
    isV1: apiVersion === 1,
    me,
    refreshMe,
    unread,
    setUnread,
    refreshUnread,
    emit,
    subscribe,
    showToast,
  }), [apiVersion, me, refreshMe, unread, refreshUnread, emit, subscribe, showToast]);

  return (
    <SocialContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? <Toast message={toast} /> : null}
      </View>
    </SocialContext.Provider>
  );
}

function Toast({ message }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [opacity]);
  return (
    <Animated.View pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom + 96, opacity }]}>
      <View style={styles.toast}>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const FALLBACK = {
  apiVersion: null, isV1: false, me: null, refreshMe: async () => {}, unread: 0,
  setUnread: () => {}, refreshUnread: async () => {}, emit: () => {}, subscribe: () => () => {}, showToast: () => {},
};

/** Nunca devuelve null: sin proveedor, la red social funciona sin conteo ni bus. */
export const useSocial = () => useContext(SocialContext) ?? FALLBACK;

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  toast: {
    backgroundColor: COLORS.ink, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18,
    shadowColor: '#1A1523', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  toastText: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: '#fff', textAlign: 'center' },
});
