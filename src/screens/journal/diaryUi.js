import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useApp } from '../../context/AppContext';
import { dayKey } from '../../lib/dates';
import { COLORS, FONTS, RADIUS } from '../../theme';

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

export function syncLabel(t, s) {
  if (!s) return null;
  const { state, pending, rejected } = s;
  if ((state === 'syncing' || state === 'checking') && pending > 0) return { text: t.diarySyncSyncing, ok: false };
  if (state === 'auth' && pending > 0) return { text: t.diarySyncAuth, ok: false };
  if (pending > 0) return { text: t.diarySyncPending, ok: false };
  if (state === 'synced') return rejected > 0 ? { text: t.diarySyncRejected, ok: false } : { text: t.diarySyncSynced, ok: true };
  return { text: t.diarySyncLocal, ok: false };
}

/** Estado de sincronización, discreto. */
export function SyncBadge({ style, align = 'center' }) {
  const { t, syncStatus } = useApp();
  const label = syncLabel(t, syncStatus);
  if (!label) return null;
  return (
    <View style={[styles.syncRow, { justifyContent: align === 'left' ? 'flex-start' : 'center' }, style]}>
      <Svg width="12" height="12" viewBox="0 0 12 12">
        {label.ok ? (
          <Path d="M2 6.5l2.5 2.5L10 3.5" stroke={COLORS.tones.mint.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : (
          <>
            <Circle cx="6" cy="6" r="4.5" stroke={COLORS.inkMuted} strokeWidth="1.4" fill="none" />
            <Path d="M6 3.5V6l1.6 1" stroke={COLORS.inkMuted} strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </>
        )}
      </Svg>
      <Text style={styles.syncText}>{label.text}</Text>
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
      <Text style={styles.crisisTitle}>{t.diaryCrisisTitle}</Text>
      <Text style={styles.crisisBody}>{t.diaryCrisisBody}</Text>
      <View style={styles.crisisRow}>
        <TouchableOpacity onPress={onSupport} style={styles.crisisBtn} accessibilityRole="button">
          <Text style={styles.crisisBtnText}>{t.diaryCrisisCta}</Text>
        </TouchableOpacity>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.crisisGhost} accessibilityRole="button">
            <Text style={styles.crisisGhostText}>{t.diaryCrisisDismiss}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.crisisPrivacy}>{t.diaryCrisisPrivacy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncText: { fontFamily: FONTS.uiMedium, fontSize: 11, color: COLORS.inkMuted },
  crisis: {
    backgroundColor: COLORS.tones.rose.bg, borderRadius: 20, padding: 18,
  },
  crisisTitle: { fontFamily: FONTS.extraBold, fontSize: 17, color: COLORS.tones.rose.ink },
  crisisBody: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, lineHeight: 20, marginTop: 6 },
  crisisRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 14 },
  crisisBtn: {
    backgroundColor: '#F37171', borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  crisisBtnText: { fontFamily: FONTS.extraBold, fontSize: 13, color: '#fff', letterSpacing: 0.4 },
  crisisGhost: { paddingVertical: 12, paddingHorizontal: 12 },
  crisisGhostText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.inkSoft },
  crisisPrivacy: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkSoft, marginTop: 10 },
});
