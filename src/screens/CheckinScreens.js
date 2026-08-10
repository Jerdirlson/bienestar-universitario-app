import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';
import MoodFace from '../components/MoodFace';
import PrimaryButton from '../components/PrimaryButton';
import IllusPlaceholder from '../components/IllusPlaceholder';
import ArticleCard from '../components/ArticleCard';
import Chip from '../components/Chip';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CheckinHeader({ step, onClose, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ciStyles.header, { paddingTop: insets.top + 12 }]}>
      <View style={{ width: 40 }}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={ciStyles.iconBtn}>
            <Svg width="10" height="18" viewBox="0 0 10 18">
              <Path d="M9 1L1 9l8 8" stroke={COLORS.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>
      <Text style={ciStyles.step}>{step}/5</Text>
      <TouchableOpacity onPress={onClose} style={[ciStyles.iconBtn, { width: 40, alignItems: 'flex-end' }]}>
        <Svg width="16" height="16" viewBox="0 0 16 16">
          <Path d="M2 2l12 12M14 2L2 14" stroke={COLORS.ink} strokeWidth="2.5" strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

// ─── CHECKIN 1: MOOD ───────────────────────────────────────────────────────
export function Checkin1Screen({ navigation, route }) {
  const { t, setMood: saveMood, userName } = useApp();
  const initialMood = route.params?.initialMood ?? 3;
  const [m, setM] = useState(initialMood);
  const insets = useSafeAreaInsets();

  return (
    <View style={[ciStyles.container, { paddingBottom: insets.bottom + 16 }]}>
      <CheckinHeader step={1} onClose={() => navigation.popToTop()} />
      <View style={ciStyles.body}>
        <Text style={ciStyles.hiText}>{userName ? `${t.hi}, ${userName}` : t.hi}</Text>
        <Text style={ciStyles.questionText}>{t.feelingToday}</Text>
        <View style={{ marginVertical: 32 }}>
          <MoodFace level={m} size={180} />
        </View>
        <Text style={[ciStyles.moodLabel, { color: COLORS.mood[m] }]}>{t.moods[m]}</Text>
        <View style={{ flex: 1 }} />
        <View style={ciStyles.moodPicker}>
          {[0, 1, 2, 3, 4].map(i => (
            <TouchableOpacity key={i} onPress={() => setM(i)}>
              <View style={{ transform: [{ scale: i === m ? 1.1 : 1 }] }}>
                <MoodFace level={i} size={40} bordered={i === m} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={ciStyles.ctaWrap}>
          <PrimaryButton onPress={() => { saveMood(m); navigation.navigate('Checkin2'); }}>
            {t.moods[m]}
          </PrimaryButton>
        </View>
      </View>
    </View>
  );
}

// ─── CHECKIN 2: FEELINGS ───────────────────────────────────────────────────
export function Checkin2Screen({ navigation }) {
  const { t, mood, feelings: savedFeelings, setFeelings } = useApp();
  const [sel, setSel] = useState(savedFeelings || []);
  const toggle = (f) => setSel(s => s.includes(f) ? s.filter(x => x !== f) : [...s, f]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[ciStyles.container, { paddingBottom: insets.bottom + 16 }]}>
      <CheckinHeader step={2} onBack={() => navigation.goBack()} onClose={() => navigation.popToTop()} />
      <View style={{ alignItems: 'center', padding: 24 }}>
        <MoodFace level={mood} size={96} />
        <Text style={[ciStyles.questionText, { marginTop: 16 }]}>{t.describe}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={ciStyles.chipGrid}>
          {/* Se guarda item.k y se muestra item.label: el histórico no depende
              del idioma ni de cómo esté redactada la etiqueta. */}
          {t.feelingItems.map(item => (
            <Chip
              key={item.k}
              selected={sel.includes(item.k)}
              onPress={() => toggle(item.k)}
            >
              {item.label}
            </Chip>
          ))}
        </View>
      </ScrollView>
      <View style={ciStyles.ctaWrap}>
        <PrimaryButton
          disabled={sel.length === 0}
          onPress={() => { setFeelings(sel); navigation.navigate('Checkin3'); }}
        >
          {t.next}
        </PrimaryButton>
      </View>
    </View>
  );
}

// ─── CHECKIN 3: CAUSES ─────────────────────────────────────────────────────
export function Checkin3Screen({ navigation }) {
  const { t, causes: savedCauses, setCauses } = useApp();
  const [sel, setSel] = useState(savedCauses || []);
  const toggle = (k) => setSel(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);
  const insets = useSafeAreaInsets();

  const iconFor = (k) => {
    const map = {
      estudios: { tone: 'sun', label: 'libros' },
      amigos: { tone: 'sky', label: 'amigos' },
      familia: { tone: 'rose', label: 'familia' },
      pareja: { tone: 'blush', label: 'pareja' },
      ejercicio: { tone: 'mint', label: 'deporte' },
      sueno: { tone: 'lilac', label: 'descanso' },
      universidad: { tone: 'sage', label: 'campus' },
      hobbies: { tone: 'peach', label: 'hobby' },
      redes: { tone: 'sky', label: 'redes' },
      comida: { tone: 'peach', label: 'comida' },
      salud: { tone: 'rose', label: 'salud' },
      dinero: { tone: 'mint', label: '$' },
    };
    return map[k] || { tone: 'lilac', label: k };
  };

  return (
    <View style={[ciStyles.container, { paddingBottom: insets.bottom + 16 }]}>
      <CheckinHeader step={3} onBack={() => navigation.goBack()} onClose={() => navigation.popToTop()} />
      <Text style={[ciStyles.questionText, { paddingHorizontal: 24, paddingBottom: 16 }]}>{t.causes}</Text>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={ciStyles.causeGrid}>
          {t.causeItems.map(item => {
            const ico = iconFor(item.k);
            const isSel = sel.includes(item.k);
            return (
              <TouchableOpacity
                key={item.k}
                onPress={() => toggle(item.k)}
                style={[ciStyles.causeBtn, isSel && ciStyles.causeBtnSel]}
              >
                <IllusPlaceholder tone={ico.tone} label={ico.label} size={50} radius={10} />
                <Text style={ciStyles.causeBtnText}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <View style={ciStyles.ctaWrap}>
        <PrimaryButton
          disabled={sel.length === 0}
          onPress={() => { setCauses(sel); navigation.navigate('Checkin4'); }}
        >
          {t.next}
        </PrimaryButton>
      </View>
    </View>
  );
}

// ─── CHECKIN 4: JOURNAL ────────────────────────────────────────────────────
export function Checkin4Screen({ navigation }) {
  const { t, lang, causes, journalText, saveEntry } = useApp();
  const [val, setVal] = useState(journalText);
  const [saving, setSaving] = useState(false);
  const highlight = causes?.length ? (t.causeItems.find(c => c.k === causes[0])?.label || '') : '';
  const insets = useSafeAreaInsets();

  // Solo avanzamos si el check-in quedó guardado: la pantalla siguiente muestra
  // la racha, y enseñar una racha que no se guardó sería mentirle a la persona.
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveEntry({ note: val });
      navigation.navigate('Checkin5');
    } catch {
      Alert.alert(
        lang === 'es' ? 'No pudimos guardar' : "Couldn't save",
        lang === 'es'
          ? 'Tu registro no se guardó. Vuelve a intentarlo.'
          : "Your check-in wasn't saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[ciStyles.container, { paddingBottom: insets.bottom + 16 }]}>
      <CheckinHeader step={4} onBack={() => navigation.goBack()} onClose={() => navigation.popToTop()} />
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={ciStyles.questionText}>
          {t.why} <Text style={{ color: COLORS.primary }}>{highlight}</Text> {t.makingFeel}
        </Text>
      </View>
      <TextInput
        value={val}
        onChangeText={setVal}
        placeholder={t.placeholder}
        placeholderTextColor={COLORS.inkMuted}
        multiline
        style={ciStyles.textarea}
      />
      <View style={[ciStyles.ctaWrap, { alignItems: 'flex-end' }]}>
        <TouchableOpacity
          onPress={finish}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          accessibilityLabel={t.finish}
          style={[ciStyles.nextBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={ciStyles.nextBtnText}>{t.finish}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CHECKIN 5: STREAK ─────────────────────────────────────────────────────
export function Checkin5Screen({ navigation }) {
  const { t, streak } = useApp();
  const insets = useSafeAreaInsets();
  // El check-in ya quedó guardado en el paso anterior, así que `streak` ya lo cuenta.

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[ci5Styles.hero, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity
          onPress={() => navigation.popToTop()}
          style={[ciStyles.iconBtn, { position: 'absolute', right: 16, top: insets.top + 12 }]}
        >
          <Svg width="16" height="16" viewBox="0 0 16 16">
            <Path d="M2 2l12 12M14 2L2 14" stroke={COLORS.ink} strokeWidth="2.5" strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>

        {/* Medal SVG */}
        <Svg viewBox="0 0 180 200" width={150} height={168}>
          <Path d="M50 0 L90 80 L70 100 L50 0" fill="#5A6B8C" />
          <Path d="M130 0 L90 80 L110 100 L130 0" fill="#3D4F70" />
          <Circle cx="90" cy="130" r="56" fill="#F4B840" />
          <Circle cx="90" cy="130" r="56" fill="none" stroke="#D19820" strokeWidth="4" />
          <Circle cx="90" cy="130" r="44" fill="#E8A928" />
          <SvgText x="90" y="144" textAnchor="middle" fontFamily="sans-serif" fontSize="40" fontWeight="900" fill="#6B3B08">
            {streak}
          </SvgText>
        </Svg>
        <Text style={ci5Styles.streakNum}>{streak} {t.dayStreak}</Text>
        <Text style={ci5Styles.streakSub}>{t.keepTracking}</Text>
      </View>

      <View style={{ padding: 16 }}>
        <Text style={ci5Styles.sectionTitle}>{t.justForYou}</Text>
        <Text style={ci5Styles.sectionSub}>{t.basedOnFeelings}</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16, marginHorizontal: -16 }}
          contentContainerStyle={{ paddingLeft: 16, gap: 12, paddingRight: 16 }}
        >
          <ArticleCard tone="sun" label="gratitud" title={t.articles[3].t} duration={t.articles[3].d} />
          <ArticleCard tone="lilac" label="reflexion" title={t.articles[4].t} duration={t.articles[4].d} />
          <ArticleCard tone="peach" label="manana" title={t.articles[5].t} duration={t.articles[5].d} />
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <PrimaryButton onPress={() => navigation.popToTop()}>
          {t.exploreMore}
        </PrimaryButton>
      </View>
    </ScrollView>
  );
}

const ciStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  step: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.inkSoft },
  iconBtn: { padding: 6 },
  body: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 8 },
  hiText: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.inkSoft },
  questionText: { fontFamily: FONTS.extraBold, fontSize: 24, color: COLORS.ink, lineHeight: 30, textAlign: 'center' },
  moodLabel: { fontFamily: FONTS.extraBold, fontSize: 18 },
  moodPicker: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  ctaWrap: { paddingHorizontal: 8, paddingBottom: 8, width: '100%' },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  causeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  causeBtn: {
    width: '30%', padding: 16, backgroundColor: '#F7F5FC',
    borderRadius: 14, alignItems: 'center', gap: 8,
  },
  causeBtnSel: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  causeBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.ink },
  textarea: {
    flex: 1, paddingHorizontal: 24, paddingTop: 8,
    fontFamily: FONTS.uiRegular, fontSize: 16, color: COLORS.ink,
    lineHeight: 24, textAlignVertical: 'top',
  },
  nextBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill,
    paddingVertical: 16, paddingHorizontal: 36, marginRight: 16,
  },
  nextBtnText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase' },
});

const ci5Styles = StyleSheet.create({
  hero: {
    backgroundColor: COLORS.primarySoft,
    padding: 24, alignItems: 'center', paddingBottom: 28,
  },
  streakNum: {
    fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink,
    marginTop: 10, textAlign: 'center',
  },
  streakSub: {
    fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft,
    marginTop: 8, textAlign: 'center', maxWidth: 280, lineHeight: 18,
  },
  sectionTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink },
  sectionSub: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, marginTop: 4 },
});
