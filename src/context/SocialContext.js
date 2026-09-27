import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './AppContext';
import { socialApi } from '../data/socialApi';
import { normalizeMe } from '../data/socialCore';
import { unreadMessages as fetchUnreadMessages } from '../data/messages';
import { registerPushToken, unregisterPushToken } from '../data/push';
import { canUsePush, hasAskedPermission, registerForPush } from '../lib/pushNotifications';
import { showAlert } from '../components/dialogs';
import { API_URL } from '../config';
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageRequests, setMessageRequests] = useState(0);
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

  // El socket (más abajo) avisa al instante; el sondeo de 60 s es solo el
  // respaldo para cuando no hay conexión abierta (sin red, servidor viejo sin
  // /ws, o mientras reconecta) — por eso cada tick se salta si el socket está
  // conectado, en vez de duplicar la misma petición que ya no hace falta.
  const socketConnectedRef = useRef(false);

  useEffect(() => {
    if (!token || apiVersion === 1) return undefined;
    let timer = null;
    const tick = () => { if (!socketConnectedRef.current) refreshUnread(); };
    const start = () => {
      if (timer) return;
      refreshUnread();
      timer = setInterval(tick, POLL_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    if (AppState.currentState === 'active' || AppState.currentState == null) start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [token, apiVersion, refreshUnread]);

  // ── mensajes privados: no leídos + solicitudes, junto al sondeo de arriba ──
  const refreshUnreadMessages = useCallback(async () => {
    if (!token || apiVersion === 1) { setUnreadMessages(0); setMessageRequests(0); return; }
    try {
      const { unread: u, requests: r } = await fetchUnreadMessages(token);
      setUnreadMessages(u);
      setMessageRequests(r);
    } catch { /* sin red: conserva el último */ }
  }, [token, apiVersion]);

  useEffect(() => {
    if (!token || apiVersion === 1) return undefined;
    let timer = null;
    const tick = () => { if (!socketConnectedRef.current) refreshUnreadMessages(); };
    const start = () => {
      if (timer) return;
      refreshUnreadMessages();
      timer = setInterval(tick, POLL_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    if (AppState.currentState === 'active' || AppState.currentState == null) start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [token, apiVersion, refreshUnreadMessages]);

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

  // ── canal en tiempo real (/ws) ──
  // Conecta con sesión y con la app en primer plano; se desconecta en
  // segundo plano. Reconexión con backoff exponencial (1 s, 2 s, 4 s… hasta
  // 30 s), y el sondeo de arriba retoma solo mientras no hay socket. Nunca
  // lleva contenido — cada aviso solo dice qué volver a pedir por HTTP.
  const wsRef = useRef(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef(null);

  const connectSocket = useCallback(() => {
    if (!token || apiVersion === 1 || !API_URL) return;
    let socket;
    try {
      const scheme = API_URL.startsWith('https') ? 'wss' : 'ws';
      const url = `${API_URL.replace(/^https?/, scheme)}/ws?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(url);
    } catch {
      return; // entorno sin WebSocket (no debería pasar en RN/web, pero nunca debe tumbar la app)
    }
    wsRef.current = socket;

    socket.onopen = () => {
      socketConnectedRef.current = true;
      backoffRef.current = 1000;
    };
    socket.onmessage = (ev) => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg?.type === 'notification') {
        refreshUnread();
        refreshUnreadMessages();
        emit({ type: 'realtime:notification' });
      } else if (msg?.type === 'message') {
        refreshUnreadMessages();
        emit({ type: 'realtime:message', conversationId: msg.conversationId ?? null });
      }
    };
    const scheduleReconnect = () => {
      socketConnectedRef.current = false;
      if (wsRef.current !== socket) return; // ya se reemplazó o se pidió desconectar a propósito
      if (reconnectTimerRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connectSocketRef.current?.();
      }, backoffRef.current);
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
    };
    socket.onclose = scheduleReconnect;
    socket.onerror = () => { try { socket.close(); } catch { /* ya cerrándose */ } };
  }, [token, apiVersion, refreshUnread, refreshUnreadMessages, emit]);

  // connectSocket se recrea con cada cambio de dependencias; el retry
  // programado necesita siempre la versión más reciente, no la que capturó
  // el closure del momento en que se armó el timeout.
  const connectSocketRef = useRef(connectSocket);
  connectSocketRef.current = connectSocket;

  const disconnectSocket = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    socketConnectedRef.current = false;
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket.readyState === socket.CONNECTING) {
        // Cerrar mientras todavía está conectando es válido (aborta el
        // intento) pero Chromium lo registra como advertencia en la consola
        // — benigna, pero rompe las pruebas e2e que vigilan errores de
        // consola. Se pide el cierre recién cuando abra, sin reaccionar ya a
        // nada de lo que llegue mientras tanto.
        socket.onopen = () => { try { socket.close(); } catch { /* ya cerrándose */ } };
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = () => {};
      } else {
        try { socket.close(); } catch { /* ya cerrándose */ }
      }
    }
  }, []);

  useEffect(() => {
    if (!token || apiVersion === 1) { disconnectSocket(); return undefined; }
    const start = () => connectSocket();
    const stop = () => disconnectSocket();
    if (AppState.currentState === 'active' || AppState.currentState == null) start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [token, apiVersion, connectSocket, disconnectSocket]);

  // ── notificaciones push: registro tras iniciar sesión, borrado al salir ──
  // Nunca al abrir la app por primera vez: solo entra en juego cuando hay
  // sesión. Una vez por sesión de la app (pushAskedRef) para no insistir cada
  // vez que la pantalla se remonta.
  const pushTokenRef = useRef(null);
  const pushAskedRef = useRef(false);

  useEffect(() => {
    if (!token || apiVersion === 1 || pushAskedRef.current) return;
    pushAskedRef.current = true;
    (async () => {
      if (!canUsePush()) return;
      const already = await hasAskedPermission();
      const proceed = async () => {
        const expoToken = await registerForPush();
        if (expoToken) {
          pushTokenRef.current = expoToken;
          registerPushToken(token, expoToken).catch(() => {});
        }
      };
      if (already) { proceed(); return; }
      // Explicación amable ANTES del permiso del sistema — nunca al abrir la
      // app por primera vez (esto solo corre con sesión ya iniciada).
      showAlert(app.t?.socPushPermissionTitle, app.t?.socPushPermissionBody, [
        { text: app.t?.socPushPermissionLater, style: 'cancel' },
        { text: app.t?.socPushPermissionEnable, onPress: proceed },
      ]);
    })();
  }, [token, apiVersion, app.t]);

  /** Llamar ANTES de cerrar sesión (mientras el token todavía es válido): borra el registro del push de este dispositivo. */
  const disablePushOnLogout = useCallback(async () => {
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    pushAskedRef.current = false;
    if (!token) return;
    try { await unregisterPushToken(token, pushToken); } catch { /* nunca debe bloquear el cierre de sesión */ }
  }, [token]);

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
    unreadMessages,
    setUnreadMessages,
    messageRequests,
    setMessageRequests,
    refreshUnreadMessages,
    emit,
    subscribe,
    showToast,
    disablePushOnLogout,
  }), [apiVersion, me, refreshMe, unread, refreshUnread, unreadMessages, messageRequests, refreshUnreadMessages, emit, subscribe, showToast, disablePushOnLogout]);

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
  setUnread: () => {}, refreshUnread: async () => {},
  unreadMessages: 0, setUnreadMessages: () => {}, messageRequests: 0, setMessageRequests: () => {}, refreshUnreadMessages: async () => {},
  emit: () => {}, subscribe: () => () => {}, showToast: () => {}, disablePushOnLogout: async () => {},
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
