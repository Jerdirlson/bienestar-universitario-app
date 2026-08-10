import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import MoodFace from '../components/MoodFace';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, SHADOW } from '../theme';

export default function CommunityScreen({ navigation }) {
  const { t, lang } = useApp();

  const posts = lang === 'es' ? [
    { mood: 3, name: 'Anónime · ING 2°', time: 'hace 12 min', body: 'Aprobé el parcial de cálculo 💚. La última semana fue dura pero valió la pena estudiar con mi grupo.', hearts: 24, comments: 8, tone: 'mint' },
    { mood: 1, name: 'Anónime · MED 4°', time: 'hace 1 h', body: 'Estoy muy ansiose por las rotaciones. ¿Alguien tiene tips para manejarlo sin colapsar?', hearts: 47, comments: 22, tone: 'rose' },
    { mood: 2, name: 'Anónime · ARQ 1°', time: 'hace 3 h', body: 'Es mi primera semana lejos de casa. Extraño mucho a mi familia pero intento enfocarme.', hearts: 56, comments: 14, tone: 'peach' },
    { mood: 4, name: 'Anónime · PSI 3°', time: 'hace 5 h', body: 'Hoy hablé con la psicóloga del campus y fue la mejor decisión 🤍', hearts: 89, comments: 31, tone: 'lilac' },
  ] : [
    { mood: 3, name: 'Anon · ENG 2nd', time: '12 min ago', body: 'Passed my calc midterm 💚. Rough week but studying with friends paid off.', hearts: 24, comments: 8, tone: 'mint' },
    { mood: 1, name: 'Anon · MED 4th', time: '1 h ago', body: "I'm so anxious about rotations. Anyone have tips to not burn out?", hearts: 47, comments: 22, tone: 'rose' },
    { mood: 2, name: 'Anon · ARCH 1st', time: '3 h ago', body: "First week away from home. Miss my family a lot, trying to stay focused.", hearts: 56, comments: 14, tone: 'peach' },
    { mood: 4, name: 'Anon · PSY 3rd', time: '5 h ago', body: 'Talked to the campus counselor today, best decision 🤍', hearts: 89, comments: 31, tone: 'lilac' },
  ];

  return (
    <View style={styles.container}>
      <TopBar title={t.community} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subHeader}>{t.supportive}</Text>

        {/* New post button */}
        <TouchableOpacity style={styles.newPost}>
          <View style={styles.newPostIcon}>
            <Svg width="16" height="16" viewBox="0 0 16 16">
              <Path d="M8 2v12M2 8h12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.newPostTitle}>{t.anonymousPost}</Text>
            <Text style={styles.newPostSub}>{t.shareFeeling}</Text>
          </View>
        </TouchableOpacity>

        {posts.map((p, i) => (
          <View key={i} style={styles.postCard}>
            <View style={styles.postHeader}>
              <MoodFace level={p.mood} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.postName}>{p.name}</Text>
                <Text style={styles.postTime}>{p.time}</Text>
              </View>
            </View>
            <Text style={styles.postBody}>{p.body}</Text>
            <View style={styles.postActions}>
              <View style={styles.actionItem}>
                <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <Path d="M8 14s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z" stroke={COLORS.inkSoft} strokeWidth="1.5" />
                </Svg>
                <Text style={styles.actionText}>{p.hearts}</Text>
              </View>
              <View style={styles.actionItem}>
                <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <Path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 3v-3H3a1 1 0 01-1-1V4z" stroke={COLORS.inkSoft} strokeWidth="1.5" />
                </Svg>
                <Text style={styles.actionText}>{p.comments}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={() => navigation.navigate('Sos')}
        style={styles.sosFab}
      >
        <Text style={styles.sosFabText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 100, gap: 12 },
  subHeader: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkSoft },
  newPost: {
    backgroundColor: COLORS.primarySoft, borderRadius: 18,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  newPostIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  newPostTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  newPostSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft },
  postCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16,
    ...SHADOW,
  },
  postHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  postName: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.ink },
  postTime: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  postBody: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, lineHeight: 20, marginBottom: 12 },
  postActions: { flexDirection: 'row', gap: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft },
  sosFab: {
    position: 'absolute', right: 16, bottom: 80,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F37171',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F37171', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  sosFabText: { fontFamily: 'Nunito_900Black', fontSize: 12, color: '#fff' },
});
