import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { dayKey } from '../../lib/dates';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { Text, Button, Icon } from '../../ui';

/** Reemplaza {n}, {date}… en un texto de i18n. */
export const fmt = (template, vars = {}) =>
  String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));

export const locale = (lang) => (lang === 'es' ? 'es-ES' : 'en-US');

/** Ilustración de cada prompt guiado (IllusPlaceholder elige el dibujo por la etiqueta). */
export const PROMPT_STYLE = {
  gratitude: { tone: 'sun', label: 'gratitud' },
  worry: { tone: 'lilac', label: 'pensamientos' },
  helped: { tone: 'mint', label: 'positivo' },
  letter: { tone: 'rose', label: 'relaciones' },
  proud: { tone: 'peach', label: 'positivo' },
  free: { tone: 'sky', label: 'diario' },
};

export const promptFor = (t, key) => t.diaryPrompts.find((p) => p.k === key) ?? null;

/** 'Hoy', 'Ayer' o 'martes, 22 de septiembre'. */
export function dayLabel(key, t, lang, today = new Date()) {
  if (key === dayKey(today)) return t.diaryToday;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y)) return t.diaryYesterday;
  const [yy, mm, dd] = key.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  const label = d.toLocaleDateString(locale(lang), {
    weekday: 'long', day: 'numeric', month: 'long',
    ...(yy !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const timeLabel = (iso, lang) =>
  new Date(iso).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });

/**
 * ¿Hay una pantalla con ese nombre en algún navegador por encima? Sirve para
 * enlazar pantallas que otro módulo agrega (Breathing, Grounding, Article)
 * sin romper si todavía no existen.
 */
export function routeExists(navigation, name) {
  let nav = navigation;
  while (nav) {
    try {
      if (nav.getState?.()?.routeNames?.includes(name)) return true;
    } catch {
      // un navegador sin estado todavía: seguimos subiendo
    }
    nav = nav.getParent?.();
  }
  return false;
}

export function navigateIfExists(navigation, name, params) {
  if (!routeExists(navigation, name)) return false;
  try {
    navigation.navigate(name, params);
    return true;
  } catch {
    return false;
  }
}

/**
 * Traduce el estado de sincronización a un texto + si está "bien" o no.
 * Prioriza "sin conexión / error" sobre cualquier otra cosa: es lo que el
 * hallazgo H4 de la auditoría pide — que Inicio y Progreso avisen cuando el
 * último intento de sincronizar falló, en vez de mostrar racha y gráficos
 * como si todo estuviera al día. `pending`/`rejected` afinan el mensaje
 * cuando sí hay conexión pero algo quedó a medias.
 */
export function syncLabel(t, s) {
  if (!s) return null;
  const { state, pending, rejected } = s;
  if (state === 'offline' || state === 'error') return { text: t.diarySyncOffline, ok: false };
  if ((state === 'syncing' || state === 'checking') && pending > 0) return { text: t.diarySyncSyncing, ok: false };
  if (state === 'auth' && pending > 0) return { text: t.diarySyncAuth, ok: false };
  if (pending > 0) return { text: t.diarySyncPending, ok: false };
  if (state === 'synced') return rejected > 0 ? { text: t.diarySyncRejected, ok: false } : { text: t.diarySyncSynced, ok: true };
  return { text: t.diarySyncLocal, ok: false };
}

/** Estado de sincronización, discreto (icono + texto `footnote`). */
export function SyncBadge({ style, align = 'center' }) {
  const { t, syncStatus } = useApp();
  const label = syncLabel(t, syncStatus);
  if (!label) return null;
  return (
    <View style={[styles.syncRow, { justifyContent: align === 'left' ? 'flex-start' : 'center' }, style]}>
      <Icon
        name={label.ok ? 'checkmark-circle' : 'cloud-offline-outline'}
        size={14}
        color={label.ok ? COLORS.success : COLORS.tertiaryLabel}
      />
      <Text variant="footnote" color={COLORS.secondaryLabel}>{label.text}</Text>
    </View>
  );
}

/**
 * Tarjeta amable cuando lo escrito sugiere riesgo (detectado en el teléfono,
 * ver lib/crisisSignals.js). Nunca bloquea: la persona decide.
 */
export function CrisisCard({ onSupport, onDismiss, style }) {
  const { t } = useApp();
  return (
    <View style={[styles.crisis, style]} accessibilityRole="alert">
      <Text variant="headline" color={COLORS.tones.rose.ink}>{t.diaryCrisisTitle}</Text>
      <Text variant="body" style={styles.crisisBody}>{t.diaryCrisisBody}</Text>
      <View style={styles.crisisRow}>
        <Button variant="filled" onPress={onSupport} style={styles.crisisBtn}>
          {t.diaryCrisisCta}
        </Button>
        {onDismiss && (
          <Button variant="plain" onPress={onDismiss} haptic={false}>
            {t.diaryCrisisDismiss}
          </Button>
        )}
      </View>
      <Text variant="caption1" color={COLORS.secondaryLabel} style={styles.crisisPrivacy}>
        {t.diaryCrisisPrivacy}
      </Text>
    </View>
  );
}

/**
 * Barra superior estándar de las pantallas de detalle del diario (§5, §6):
 * "atrás" o "cerrar" a la izquierda, título centrado, acción opcional a la
 * derecha. Reemplaza el viejo `TopBar` (fuera de `src/ui/`, con tipografía y
 * mayúsculas del sistema anterior) solo en las pantallas de esta área — las
 * demás pantallas de la app lo siguen usando tal cual hasta que se rediseñen.
 */
export function ScreenHeader({ title, onBack, onClose, right }) {
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerBar, { paddingTop: insets.top + SPACING.xs }]}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t.diaryBack}
          >
            <Icon name="chevron-back" size={26} color={COLORS.accent} />
          </Pressable>
        ) : onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t.socClose}
          >
            <Icon name="close-circle" size={26} color={COLORS.tertiaryLabel} />
          </Pressable>
        ) : null}
      </View>
      <Text variant="headline" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>{right}</View>
    </View>
  );
}

const HEADER_SIDE = 44;

const styles = StyleSheet.create({
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  crisis: {
    backgroundColor: COLORS.tones.rose.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  crisisBody: { color: COLORS.label, marginTop: SPACING.xs },
  crisisRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  crisisBtn: { backgroundColor: COLORS.destructive, paddingHorizontal: SPACING.lg },
  crisisPrivacy: { marginTop: SPACING.sm },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingBottom: SPACING.sm,
  },
  headerSide: { width: HEADER_SIDE, alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  headerBtn: { width: HEADER_SIDE, height: HEADER_SIDE, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: COLORS.label },
});
