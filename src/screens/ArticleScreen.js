import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import ScreenHeader from '../components/wellness/ScreenHeader';
import IllusPlaceholder from '../components/IllusPlaceholder';
import { useApp } from '../context/AppContext';
import { getArticle } from '../data/wellnessContent';
import { fmt } from '../i18n/wellness';
import { Screen, Text, Card } from '../ui';
import { COLORS, SPACING, RADIUS } from '../theme';
import { showAlert } from '../components/dialogs';

export default function ArticleScreen({ navigation, route }) {
  const { t, lang } = useApp();
  const article = getArticle(route?.params?.id);
  const content = article ? (article[lang] ?? article.es) : null;

  const openSource = (url) => {
    Linking.openURL(url).catch(() => showAlert(t.linkErrorTitle, t.linkErrorBody));
  };

  return (
    <Screen variant="plain" edges={['left', 'right', 'bottom']}>
      <ScreenHeader title={t.exploreTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!article && <Text variant="body">{t.wlArticleNotFound}</Text>}

        {article && (
          <>
            <View style={[styles.hero, { backgroundColor: COLORS.tones[article.tone]?.bg ?? COLORS.tones.lilac.bg }]}>
              <IllusPlaceholder tone={article.tone} label={article.illus} size={96} radius={RADIUS.xl} />
            </View>
            <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.readTime}>{fmt(t.wlReadTime, { n: article.minutes })}</Text>
            {/* Lectura cómoda (docs/design-system.md, instrucción de esta
                tarea): ancho de línea acotado, `body` 17 con interlineado
                generoso — nunca todo el ancho de la pantalla de punta a punta. */}
            <Text variant="title1" style={styles.title}>{content.title}</Text>
            <Text variant="body" color={COLORS.secondaryLabel} style={styles.summary}>{content.summary}</Text>

            {content.sections.map((s, i) => (
              <View key={i} style={styles.section}>
                {s.h ? <Text variant="title3" style={styles.h}>{s.h}</Text> : null}
                {s.p ? <Text variant="body" style={styles.body}>{s.p}</Text> : null}
                {s.list ? s.list.map((item, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <Text variant="body" color={COLORS.accent}>{'•'}</Text>
                    <Text variant="body" style={[styles.body, { flex: 1 }]}>{item}</Text>
                  </View>
                )) : null}
              </View>
            ))}

            <TouchableOpacity
              onPress={() => navigation.navigate('Sos')}
              activeOpacity={0.85}
            >
              <Card style={article.sos ? [styles.sosCard, styles.sosCardStrong] : styles.sosCard}>
                <Text variant="headline">{t.wlNeedHelpNow}</Text>
                <Text variant="subhead" color={COLORS.secondaryLabel}>{t.wlNeedHelpBody}</Text>
                <Text variant="headline" color={COLORS.tones.rose.ink} style={{ marginTop: SPACING.xs }}>{t.wlGoToSos} →</Text>
              </Card>
            </TouchableOpacity>

            <View style={styles.sources}>
              <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.sourcesTitle}>{t.wlSources}</Text>
              {article.sources.map(s => (
                <TouchableOpacity key={s.url} onPress={() => openSource(s.url)} accessibilityRole="link">
                  <Text variant="subhead" color={COLORS.accent} style={styles.sourceLink}>{s.name}</Text>
                </TouchableOpacity>
              ))}
              <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.disclaimer}>{t.wlDisclaimer}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.md, maxWidth: 640, alignSelf: 'center', width: '100%' },
  hero: { borderRadius: RADIUS.xl, paddingVertical: SPACING.xl, alignItems: 'center' },
  readTime: { marginTop: SPACING.xs },
  title: { color: COLORS.label, marginTop: 2 },
  // Interlineado generoso (24) sobre `body` (17/22): la instrucción pide
  // "cómoda", un poco más aireado que el valor base del token.
  summary: { lineHeight: 24 },
  section: { gap: SPACING.sm },
  h: { marginTop: SPACING.xs },
  body: { lineHeight: 26 },
  bulletRow: { flexDirection: 'row', gap: SPACING.sm },
  sosCard: { gap: SPACING.xs, marginTop: SPACING.xs },
  sosCardStrong: { backgroundColor: COLORS.tones.rose.bg },
  sources: { gap: SPACING.sm, marginTop: SPACING.xs, paddingTop: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.separator },
  sourcesTitle: { textTransform: 'uppercase', letterSpacing: 1 },
  sourceLink: { textDecorationLine: 'underline', lineHeight: 22 },
  disclaimer: { lineHeight: 18, marginTop: SPACING.xs },
});
