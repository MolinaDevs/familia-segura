import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { StatusPill } from '@/components/StatusPill';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setAppLimit, addExtraTime, toggleApp } = useFamily();
  const app = data.apps.find((item) => item.id === id);
  const limitOptions = [15, 30, 45, 60, 90, 120];

  if (!app) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
        <Text style={[styles.helper, { color: colors.mutedForeground, textAlign: 'center' }]}>Este app não tem mais regra para {data.childName}.</Text>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}><Text style={[styles.extraText, { color: colors.primary }]}>Voltar</Text></Pressable>
      </View>
    );
  }
  const percent = app.effectiveLimit ? Math.min(100, Math.round((app.usageToday / app.effectiveLimit) * 100)) : 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12, paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 40 }]}>
      <View style={styles.nav}><Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={23} color={colors.foreground} /></Pressable><Text style={[styles.navTitle, { color: colors.foreground }]}>Detalhes do app</Text><View style={{ width: 23 }} /></View>
      <View style={styles.hero}>
        <AppIcon name={app.icon} color={app.iconColor} size={64} />
        <Text style={[styles.appName, { color: colors.foreground }]}>{app.name}</Text>
        <Text style={[styles.category, { color: colors.mutedForeground }]}>{app.category}</Text>
        <View style={styles.statusWrap}><StatusPill status={app.status} /></View>
      </View>

      <View style={[styles.usageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.usageHeader}><Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>USO DE HOJE</Text><Text style={[styles.usageValue, { color: colors.foreground }]}>{app.usageToday} <Text style={styles.minutes}>min</Text></Text></View>
        <View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.progress, { width: `${percent}%`, backgroundColor: percent > 90 ? colors.destructive : app.iconColor }]} /></View>
        <View style={styles.usageFooter}><Text style={[styles.footerText, { color: colors.mutedForeground }]}>Limite atual</Text><Text style={[styles.footerStrong, { color: colors.foreground }]}>{app.status === 'bloqueado' ? 'Acesso bloqueado' : app.dailyLimit ? `${app.dailyLimit} min por dia` : 'Acesso bloqueado'}{app.extraToday ? ` + ${app.extraToday} min hoje` : ''}</Text></View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Escolha um limite diário</Text>
      <View style={styles.options}>
        {limitOptions.map((option) => (
          <Pressable key={option} testID={`limit-${option}`} onPress={() => { void Haptics.selectionAsync(); setAppLimit(app.id, option); }} style={[styles.option, { borderColor: app.dailyLimit === option ? colors.primary : colors.border, backgroundColor: app.dailyLimit === option ? colors.secondary : colors.card }]}>
            <Text style={[styles.optionText, { color: app.dailyLimit === option ? colors.primary : colors.foreground }]}>{option}</Text>
            <Text style={[styles.optionUnit, { color: app.dailyLimit === option ? colors.primary : colors.mutedForeground }]}>min</Text>
          </Pressable>
        ))}
      </View>

      <Pressable testID="block-app" onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleApp(app.id); }} style={({ pressed }) => [styles.blockButton, { backgroundColor: app.status === 'bloqueado' ? colors.secondary : '#fde8e5' }, pressed && styles.pressed]}>
        <Feather name={app.status === 'bloqueado' ? 'unlock' : 'slash'} size={17} color={app.status === 'bloqueado' ? colors.secondaryForeground : colors.destructive} />
        <Text style={[styles.blockText, { color: app.status === 'bloqueado' ? colors.secondaryForeground : colors.destructive }]}>{app.status === 'bloqueado' ? 'Permitir aplicativo' : 'Bloquear aplicativo'}</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 28 }]}>Exceção temporária</Text>
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>Libera minutos só para hoje, sem alterar o limite diário.</Text>
      <View style={styles.extraRow}>
        {[15, 30, 60].map((minutes) => <Pressable key={minutes} testID={`extra-${minutes}`} onPress={() => { void Haptics.selectionAsync(); addExtraTime(app.id, minutes); }} style={[styles.extraButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="plus" size={15} color={colors.primary} /><Text style={[styles.extraText, { color: colors.foreground }]}>{minutes} min</Text></Pressable>)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  navTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  hero: { alignItems: 'center', marginBottom: 26 },
  appName: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.6, marginTop: 13 },
  category: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
  statusWrap: { marginTop: 12 },
  usageCard: { borderRadius: 21, borderWidth: 1, padding: 18 },
  usageHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  cardLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  usageValue: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.7 },
  minutes: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  track: { height: 9, borderRadius: 99, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 99 },
  usageFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  footerStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 27, marginBottom: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  option: { width: '18%', minWidth: 54, flexGrow: 1, borderRadius: 15, borderWidth: 1, alignItems: 'center', paddingVertical: 11 },
  optionText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  optionUnit: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  blockButton: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 17 },
  blockText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: -4 },
  extraRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  extraButton: { flex: 1, height: 47, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  extraText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pressed: { opacity: 0.75 },
});