import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isChild, setIsChild] = useState<boolean | null>(null);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('childMode')
      .then((value) => setIsChild(value === 'true'))
      .catch(() => setIsChild(false));
  }, []);

  if (!isLoaded || isChild === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isChild) return <Redirect href="/(child)" />;
  if (isSignedIn) return <Redirect href="/(app)" />;

  const paddingTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : Math.max(insets.top, 40);
  const paddingBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : Math.max(insets.bottom, 24);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop, paddingBottom, paddingHorizontal: 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.iconContainer}>
          <Feather name="shield" size={42} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          Confiança se constrói com transparência.
        </Text>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Acompanhe o bem-estar digital da sua família de forma clara e visível. Defina rotinas, combine limites e mostre às crianças exatamente o que está sendo protegido.
        </Text>
      </View>

      <View style={styles.features}>
        <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.featureIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="eye" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.featureTitle, { color: colors.foreground }]}>Visibilidade Mútua</Text>
          <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>Sem monitoramento oculto. As crianças sabem quais regras estão ativas e o porquê de cada uma delas.</Text>
        </View>

        <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.featureIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="clock" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.featureTitle, { color: colors.foreground }]}>Rotinas Saudáveis</Text>
          <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>Crie horários previsíveis para estudo, sono e lazer sem interrupções indesejadas.</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          testID="home-create-account"
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/sign-up')}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Criar uma conta</Text>
        </Pressable>

        <Pressable
          testID="home-sign-in"
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/sign-in')}
          style={({ pressed }) => [styles.secondaryButton, { backgroundColor: 'transparent', borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Já tenho conta</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(child)/pair')}
          style={({ pressed }) => [styles.childLink, pressed && styles.pressed]}
        >
          <View style={[styles.childLinkIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="smartphone" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.childLinkText, { color: colors.foreground }]}>
            Configurar este aparelho para a criança
          </Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ marginLeft: 'auto' }} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', flexGrow: 1 },
  
  hero: { marginTop: 40, marginBottom: 48, alignItems: 'center' },
  iconContainer: { width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(42, 90, 74, 0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 36, lineHeight: 42, letterSpacing: -1.2, marginBottom: 16, textAlign: 'center', maxWidth: 480 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 500 },
  
  features: { gap: 16, marginBottom: 48 },
  featureCard: { borderWidth: 1, borderRadius: 24, padding: 24 },
  featureIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  featureTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 8 },
  featureDesc: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 },
  
  actions: { gap: 14, marginBottom: 48, maxWidth: 400, width: '100%', alignSelf: 'center' },
  primaryButton: { width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  secondaryButton: { width: '100%', height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  
  footer: { marginTop: 'auto' },
  divider: { width: '100%', height: 1, marginBottom: 16 },
  childLink: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 12 },
  childLinkIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  childLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});