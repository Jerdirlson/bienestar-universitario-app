import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import TopBar from '../../components/TopBar';
import { useApp } from '../../context/AppContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../theme';

/** Normas de la comunidad, breves, con el acceso a Sos al final. */
export default function CommunityGuidelinesScreen({ navigation }) {
  const { t } = useApp();
  return (
    <View style={styles.container}>
      <TopBar title={t.socGuidelinesTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t.socGuidelinesIntro}</Text>
        {t.socGuidelinesItems.map((item, i) => (
          <View key={item.title} style={styles.card}>
            <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        ))}
        <View style={styles.crisis}>
          <Text style={styles.crisisText}>{t.socGuidelinesCrisis}</Text>
          <TouchableOpacity style={styles.sosBtn} onPress={() => navigation.navigate('Sos')} accessibilityRole="button">
            <Text style={styles.sosBtnText}>{t.socSeeSupport}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, lineHeight: 21 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 16, ...SHADOW },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: FONTS.black, fontSize: 13, color: COLORS.primary },
  title: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  body: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, lineHeight: 19 },
  crisis: { backgroundColor: COLORS.tones.rose.bg, borderRadius: RADIUS.lg, padding: 16, gap: 12, marginTop: 4 },
  crisisText: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.tones.rose.ink, lineHeight: 20 },
  sosBtn: { backgroundColor: '#F37171', borderRadius: RADIUS.pill, paddingVertical: 13, alignItems: 'center' },
  sosBtnText: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
});
