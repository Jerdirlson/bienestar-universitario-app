import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Header from '../../components/social/Header';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Text from '../../ui/Text';
import { useApp } from '../../context/AppContext';
import { COLORS, RADIUS, SPACING } from '../../theme';

/** Normas de la comunidad, breves, con el acceso a Sos al final. */
export default function CommunityGuidelinesScreen({ navigation }) {
  const { t } = useApp();
  return (
    <View style={styles.container}>
      <Header title={t.socGuidelinesTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="body" color={COLORS.secondaryLabel} style={styles.intro}>{t.socGuidelinesIntro}</Text>
        {t.socGuidelinesItems.map((item, i) => (
          <Card key={item.title} style={styles.card}>
            <View style={styles.num}><Text variant="headline" color={COLORS.accent}>{i + 1}</Text></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headline">{item.title}</Text>
              <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.body}>{item.body}</Text>
            </View>
          </Card>
        ))}
        <View style={styles.crisis}>
          <Text variant="subhead" color={COLORS.tones.rose.ink} style={styles.crisisText}>{t.socGuidelinesCrisis}</Text>
          <Button variant="filled" style={styles.sosBtn} onPress={() => navigation.navigate('Sos')}>{t.socSeeSupport}</Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  intro: { lineHeight: 21 },
  card: { flexDirection: 'row', gap: SPACING.md },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.accentTint, alignItems: 'center', justifyContent: 'center' },
  body: { lineHeight: 19 },
  crisis: { backgroundColor: COLORS.tones.rose.bg, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md, marginTop: SPACING.xs },
  crisisText: { lineHeight: 20 },
  sosBtn: { backgroundColor: COLORS.sos },
});
