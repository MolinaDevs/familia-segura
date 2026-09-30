import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { BrandLoading } from '@/components/brand/BrandLoading';
import { BreathingEmblem, Logo } from '@/components/brand/Logo';
import { BrandBackground } from '@/components/brand/BrandBackground';
import { AuthButton } from '@/components/auth/AuthKit';

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

/** Um combinado como ele aparece no app: ícone, regra e o efeito. */
function RulePill({ icon, tint, title, detail, offset }: { icon: IconName; tint: string; title: string; detail: string; offset: number }) {
  const colors = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border, marginLeft: offset, shadowColor: colors.shadow }]}>
      <View style={[styles.pillIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={16} color={colors.navy} />
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
        <Icon name={icon} size={22} color={colors.navy} />
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
    <BrandBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={rise[0]}>
          <Logo size={36} />
        </Animated.View>

        <Animated.View style={[styles.stage, { backgroundColor: colors.stage, borderColor: colors.border, shadowColor: colors.shadow }, rise[1]]}>
          <BreathingEmblem size={112} />
          <View style={styles.pills}>
            <RulePill icon="moon" tint={colors.blueSoft} title="Hora de dormir" detail="21h às 7h, sem tela" offset={0} />
            <RulePill icon="play" tint={colors.peachSoft} title="YouTube Kids" detail="1 hora por dia" offset={14} />
            <RulePill icon="download" tint={colors.mintSoft} title="App novo" detail="só com o seu sim" offset={4} />
          </View>
        </Animated.View>

        <Animated.View style={rise[2]}>
          <View style={[styles.seal, { backgroundColor: colors.peachSoft }]}>
            <Icon name="shield" size={13} color={colors.accent} />
            <Text style={[styles.sealText, { color: colors.accent }]}>ALINHADO AO ECA DIGITAL E À LGPD</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
            A vida digital da família, combinada e protegida
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Limite o tempo de cada app, pause tudo na hora de dormir e aprove os downloads, no iPhone e no Android. Seu filho vê as mesmas regras que você.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.values, rise[3]]}>
          <ValueRow icon="users" tint={colors.blueSoft} title="Toda a família num só lugar"
            detail="Até 10 crianças e 10 aparelhos, com iPhone e Android misturados." />
          <ValueRow icon="eye" tint={colors.peachSoft} title="Transparência, não espionagem"
            detail="A criança sabe o que está valendo e pede mais tempo pelo próprio aparelho." />
          <ValueRow icon="lock" tint={colors.mintSoft} title="Proteção que não se desliga sozinha" last
            detail="Apagar o app ou mexer nas configurações exige o seu PIN." />
        </Animated.View>

        <Animated.View style={[styles.actions, rise[4]]}>
          <AuthButton label="Começar grátis" onPress={() => router.push('/(auth)/sign-up')} testID="home-create-account" />
          <AuthButton label="Já tenho conta" variant="outline" onPress={() => router.push('/(auth)/sign-in')} testID="home-sign-in" />
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(child)/pair')}
          style={({ pressed }) => [styles.childLink, { borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}
          testID="home-child-device"
        >
          <View style={[styles.childIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="smartphone" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.childTitle, { color: colors.foreground }]}>Este é o celular do seu filho?</Text>
            <Text style={[styles.childDetail, { color: colors.mutedForeground }]}>Conecte com o código gerado no seu app</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },

  stage: {
    borderRadius: 28, borderWidth: 1, marginTop: 20, padding: 16, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 2,
  },
  pills: { flex: 1, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 9,
    shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 1,
  },
  pillIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pillTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 13 },
  pillDetail: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 11.5 },

  seal: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 26 },
  sealText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 10.5, letterSpacing: 1.1 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 27, lineHeight: 34, letterSpacing: -0.5, marginTop: 12 },
  subtitle: { fontFamily: 'NunitoSans_500Medium', fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 520 },

  values: { marginTop: 18 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  valueIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  valueTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 15.5 },
  valueDetail: { fontFamily: 'NunitoSans_500Medium', fontSize: 14, lineHeight: 20, marginTop: 2 },

  actions: { gap: 10, marginTop: 18 },

  childLink: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 18, marginBottom: 4, borderTopWidth: 1, minHeight: 64 },
  childIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  childTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  childDetail: { fontFamily: 'NunitoSans_500Medium', fontSize: 13, marginTop: 1 },
});
