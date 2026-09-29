import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BrandLoading } from '@/components/brand/BrandLoading';
import { Logo, SquishyMark } from '@/components/brand/Logo';
import { SkyBackground } from '@/components/brand/SkyBackground';
import { AuthButton } from '@/components/auth/AuthKit';

type IconName = React.ComponentProps<typeof Feather>['name'];

/** Entrada em cascata: move, não revela (sem opacity 0 — animação que não roda não esconde conteúdo). */
function useRise(count: number) {
  const values = useRef(Array.from({ length: count }, () => new Animated.Value(1))).current;
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      values.forEach((v) => v.setValue(0));
      Animated.stagger(90, values.map((v) => Animated.spring(v, { toValue: 1, stiffness: 120, damping: 16, useNativeDriver: true }))).start();
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [values]);
  return values.map((v) => ({ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }));
}

/** Um "combinado" como o app mostra de verdade: ícone, regra e onde vale. */
function RulePill({ icon, dot, title, detail, offset }: { icon: IconName; dot: string; title: string; detail: string; offset: number }) {
  const colors = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border, marginLeft: offset, shadowColor: colors.shadow }]}>
      <View style={[styles.pillIcon, { backgroundColor: dot }]}>
        <Feather name={icon} size={14} color="#2E2545" />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={[styles.pillTitle, { color: colors.foreground }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.pillDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
    </View>
  );
}

function ValueRow({ icon, tint, title, detail, last }: { icon: IconName; tint: string; title: string; detail: string; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.valueRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={[styles.valueIcon, { backgroundColor: tint }]}>
        <Feather name={icon} size={18} color="#2E2545" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.valueTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.valueDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
    </View>
  );
}

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isChild, setIsChild] = useState<boolean | null>(null);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rise = useRise(5);

  useEffect(() => {
    AsyncStorage.getItem('childMode')
      .then((value) => setIsChild(value === 'true'))
      .catch(() => setIsChild(false));
  }, []);

  // Modo criança não espera o login carregar (pode estar sem internet).
  if (isChild) return <Redirect href="/(child)" />;
  if (!isLoaded || isChild === null) return <BrandLoading />;
  if (isSignedIn) return <Redirect href="/(app)" />;

  const paddingTop = Platform.OS === 'web' ? Math.max(insets.top, 24) : insets.top + 12;
  const paddingBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 24) : insets.bottom + 16;

  return (
    <SkyBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={rise[0]}>
          <Logo size={34} />
        </Animated.View>

        <Animated.View style={[styles.stage, { backgroundColor: colors.secondary }, rise[1]]}>
          <SquishyMark size={104} style={styles.stageMark} />
          <View style={styles.pills}>
            <RulePill icon="moon" dot={colors.grapeLite} title="Hora de dormir" detail="21h às 7h · tela travada" offset={0} />
            <RulePill icon="play" dot={colors.butter} title="YouTube Kids" detail="45 min por dia" offset={18} />
            <RulePill icon="download" dot={colors.mint} title="App novo" detail="só com a sua aprovação" offset={6} />
          </View>
        </Animated.View>

        <Animated.View style={rise[2]}>
          <View style={[styles.seal, { backgroundColor: colors.dangerSoft }]}>
            <Text style={[styles.sealText, { color: colors.accent }]}>ECA DIGITAL · LGPD</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
            Combinados claros para a vida digital da família
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Tempo de tela, hora de dormir e aprovação de apps no iPhone e no Android. E a criança sempre vê o que está valendo, sem espionagem.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.values, rise[3]]}>
          <ValueRow icon="users" tint={colors.mint} title="Uma conta para a família toda"
            detail="Até 10 crianças e 10 aparelhos, com iPhone e Android misturados." />
          <ValueRow icon="eye" tint={colors.butter} title="Nada escondido" last
            detail="A criança vê as regras e pede mais tempo pelo próprio aparelho." />
        </Animated.View>

        <Animated.View style={[styles.actions, rise[4]]}>
          <AuthButton label="Criar conta grátis" onPress={() => router.push('/(auth)/sign-up')} testID="home-create-account" />
          <AuthButton label="Já tenho conta" variant="outline" onPress={() => router.push('/(auth)/sign-in')} testID="home-sign-in" />
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(child)/pair')}
          style={({ pressed }) => [styles.childLink, { borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}
          testID="home-child-device"
        >
          <View style={[styles.childIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="smartphone" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.childTitle, { color: colors.foreground }]}>Este aparelho é da criança?</Text>
            <Text style={[styles.childDetail, { color: colors.mutedForeground }]}>Parear com o código do responsável</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },

  stage: { borderRadius: 36, marginTop: 22, padding: 18, paddingVertical: 22, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  stageMark: { marginLeft: -2 },
  pills: { flex: 1, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10,
    shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 1,
  },
  pillIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pillTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13 },
  pillDetail: { fontFamily: 'Nunito_600SemiBold', fontSize: 11.5 },

  seal: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 28 },
  sealText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11, letterSpacing: 1.6 },
  title: { fontFamily: 'Fredoka_600SemiBold', fontSize: 32, lineHeight: 38, letterSpacing: -0.7, marginTop: 12 },
  subtitle: { fontFamily: 'Nunito_500Medium', fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 520 },

  values: { marginTop: 22 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  valueIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  valueTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5 },
  valueDetail: { fontFamily: 'Nunito_500Medium', fontSize: 14, lineHeight: 20, marginTop: 2 },

  actions: { gap: 10, marginTop: 20 },

  childLink: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 18, marginBottom: 4, borderTopWidth: 1, minHeight: 64 },
  childIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  childTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15 },
  childDetail: { fontFamily: 'Nunito_500Medium', fontSize: 13, marginTop: 1 },
});
