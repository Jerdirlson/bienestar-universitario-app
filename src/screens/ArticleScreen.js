import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import TopBar from '../components/TopBar';
import IllusPlaceholder from '../components/IllusPlaceholder';
import { useApp } from '../context/AppContext';
import { getArticle } from '../data/wellnessContent';
import { fmt } from '../i18n/wellness';
import { COLORS, FONTS, SHADOW } from '../theme';
import { showAlert } from '../components/dialogs';

export default function ArticleScreen({ navigation, route }) {
  const { t, lang } = useApp();
  const article = getArticle(route?.params?.id);
  const content = article ? (article[lang] ?? article.es) : null;

  const openSource = (url) => {
    Linking.openURL(url).catch(() => showAlert(t.linkErrorTitle, t.linkErrorBody));
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.exploreTitle} onBack={() => navigation.goBack()} right={<View />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!article && <Text style={styles.body}>{t.wlArticleNotFound}</Text>}

        {article && (
          <>
            <View style={[styles.hero, { backgroundColor: COLORS.tones[article.tone]?.bg ?? COLORS.tones.lilac.bg }]}>
              <IllusPlaceholder tone={article.tone} label={article.illus} size={96} radius={20} />
            </View>
            <Text style={styles.readTime}>{fmt(t.wlReadTime, { n: article.minutes })}</Text>
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.summary}>{content.summary}</Text>

            {content.sections.map((s, i) => (
              <View key={i} style={styles.section}>
                {s.h ? <Text style={styles.h}>{s.h}</Text> : null}
                {s.p ? <Text style={styles.body}>{s.p}</Text> : null}
                {s.list ? s.list.map((item, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.body, { flex: 1 }]}>{item}</Text>
                  </View>
                )) : null}
              </View>
            ))}

            <TouchableOpacity
              onPress={() => navigation.navigate('Sos')}
              activeOpacity={0.85}
              style={[styles.sosCard, article.sos && styles.sosCardStrong]}
            >
              <Text style={styles.sosTitle}>{t.wlNeedHelpNow}</Text>
              <Text style={styles.sosBody}>{t.wlNeedHelpBody}</Text>
              <Text style={styles.sosLink}>{t.wlGoToSos} →</Text>
            </TouchableOpacity>

            <View style={styles.sources}>
              <Text style={styles.sourcesTitle}>{t.wlSources}</Text>
              {article.sources.map(s => (
                <TouchableOpacity key={s.url} onPress={() => openSource(s.url)} accessibilityRole="link">
                  <Text style={styles.sourceLink}>{s.name}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.disclaimer}>{t.wlDisclaimer}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  hero: { borderRadius: 22, paddingVertical: 24, alignItems: 'center' },
  readTime: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkMuted, marginTop: 4 },
  title: { fontFamily: FONTS.extraBold, fontSize: 26, color: COLORS.ink, lineHeight: 32 },
  summary: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.inkSoft, lineHeight: 22 },
  section: { gap: 8 },
  h: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink, marginTop: 6 },
  body: { fontFamily: FONTS.uiRegular, fontSize: 15, color: COLORS.ink, lineHeight: 23 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontFamily: FONTS.black, fontSize: 15, color: COLORS.primary, lineHeight: 23 },
  sosCard: { backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16, gap: 4, marginTop: 8, ...SHADOW },
  sosCardStrong: { backgroundColor: COLORS.tones.rose.bg },
  sosTitle: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.ink },
  sosBody: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft },
  sosLink: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.tones.rose.ink, marginTop: 4 },
  sources: { gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.hair },
  sourcesTitle: { fontFamily: FONTS.uiBold, fontSize: 12, color: COLORS.inkMuted, letterSpacing: 1, textTransform: 'uppercase' },
  sourceLink: { fontFamily: FONTS.uiMedium, fontSize: 13, color: COLORS.primary, textDecorationLine: 'underline', lineHeight: 19 },
  disclaimer: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted, lineHeight: 16, marginTop: 6 },
});
