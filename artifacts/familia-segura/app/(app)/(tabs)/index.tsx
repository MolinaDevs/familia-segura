import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusPill } from '@/components/StatusPill';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, totalUsage, usagePercent } = useFamily();
  const attentionApps = useMemo(() => data.apps.filter((app) => app.status === 'atenção' || app.status === 'bloqueado').slice(0, 3), [data.apps]);
  const hourLabel = `${Math.floor(totalUsage / 60)}h ${totalUsage % 60}min`;
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const activeRoutine = data.routines.find((routine) => routine.enabled);

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16, paddingBottom: Platform.OS === 'web' ? 118 : insets.bottom + 100 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{today}</Text>
          <Text style={[styles.greeting, { color: colors.foreground }]}>Olá, família.</Text>
        </View>
        <Pressable testID="home-profile" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.profileButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          <Text style={[styles.profileLetter, { color: colors.primaryForeground }]}>{data.guardianName ? data.guardianName[0] : 'M'}</Text>
          <View style={[styles.onlineDot, { borderColor: colors.primary }]} />
        </Pressable>
      </View>

      {data.devices.length === 0 ? (
        <View style={[styles.setupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.setupIconArea, { backgroundColor: colors.secondary }]}>
            <Feather name="smartphone" size={28} color={colors.secondaryForeground} />
          </View>
          <Text style={[styles.setupTitle, { color: colors.foreground }]}>Espaço de {data.childName}</Text>
          <Text style={[styles.setupCopy, { color: colors.mutedForeground }]}>
            Para acompanhar o bem-estar digital e ativar proteções, precisamos conectar o dispositivo de {data.childName}.
          </Text>
          <View style={[styles.setupNotice, { backgroundColor: colors.background }]}>
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text style={[styles.setupNoticeText, { color: colors.mutedForeground }]}>Lembre-se: os limites só funcionam após a configuração no aparelho real.</Text>
          </View>
          <Pressable
            testID="home-pair-device"
            accessibilityRole="button"
            onPress={() => router.push('/(app)/(tabs)/profile')}
            style={({ pressed }) => [styles.setupButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.setupButtonText, { color: colors.primaryForeground }]}>Vincular dispositivo</Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : (
      <>
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.7)' }]}>HOJE</Text>
              <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>Uso de {data.childName}</Text>
            </View>
            <View style={[styles.heroShield, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Feather name="activity" size={22} color={colors.primaryForeground} />
            </View>
          </View>
          <View style={styles.usageRow}>
            <View>
              <Text style={[styles.usageLabel, { color: 'rgba(255,255,255,0.7)' }]}>TEMPO TOTAL</Text>
              <Text style={[styles.usageValue, { color: colors.primaryForeground }]}>{hourLabel}</Text>
            </View>
            <View style={[styles.circle, { borderColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={[styles.circleValue, { color: colors.primaryForeground }]}>{usagePercent}%</Text>
              <Text style={[styles.circleLabel, { color: 'rgba(255,255,255,0.7)' }]}>limite</Text>
            </View>
          </View>
          <View style={[styles.heroTrack, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <View style={[styles.heroProgress, { width: `${usagePercent}%`, backgroundColor: colors.accent }]} />
          </View>
        </View>

        <SectionHeader title="Atenção hoje" action="Ver todos" onPress={() => router.push('/apps')} />
        <View style={styles.attentionList}>
          {attentionApps.map((app) => (
            <Pressable key={app.id} testID={`attention-${app.id}`} onPress={() => router.push({ pathname: '/app/[id]', params: { id: app.id } })} style={({ pressed }) => [styles.attentionItem, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
              <AppIcon name={app.icon} color={app.iconColor} size={42} />
              <View style={styles.attentionCopy}>
                <Text style={[styles.attentionTitle, { color: colors.foreground }]}>{app.name}</Text>
                <Text style={[styles.attentionSub, { color: colors.mutedForeground }]}>{app.status === 'bloqueado' ? 'Acesso restrito' : `${app.usageToday} min de ${app.dailyLimit} min`}</Text>
              </View>
              <StatusPill status={app.status} />
            </Pressable>
          ))}
          {attentionApps.length === 0 && <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tudo tranquilo por enquanto.</Text></View>}
        </View>

        <SectionHeader title="Rotina atual" action="Ajustar" onPress={() => router.push('/routine')} />
        {activeRoutine ? (
          <Pressable testID="sleep-routine" onPress={() => router.push('/routine')} style={({ pressed }) => [styles.routineCard, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
            <View style={[styles.routineIcon, { backgroundColor: colors.card }]}>
              <Feather name={activeRoutine.icon as any || 'moon'} size={20} color={colors.secondaryForeground} />
            </View>
            <View style={styles.routineCopy}>
              <Text style={[styles.routineTitle, { color: colors.secondaryForeground }]}>{activeRoutine.title}</Text>
              <Text style={[styles.routineSub, { color: colors.secondaryForeground, opacity: 0.8 }]}>{activeRoutine.start} às {activeRoutine.end}</Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: colors.card }]}>
              <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.activeText, { color: colors.foreground }]}>Ativa</Text>
            </View>
          </Pressable>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma pausa programada.</Text></View>
        )}

        <View style={styles.footerNote}>
          <Feather name="shield" size={16} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Regras digitais claras e transparentes para a família inteira.</Text>
        </View>
      </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textTransform: 'capitalize', marginBottom: 4 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1.2 },
  profileButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  profileLetter: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 12, backgroundColor: '#4ade80', borderWidth: 2 },
  
  setupCard: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 16 },
  setupIconArea: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  setupTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
  setupCopy: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  setupNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  setupNoticeText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1, lineHeight: 18 },
  setupButton: { minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  setupButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },

  heroCard: { borderRadius: 28, padding: 24, marginBottom: 32 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5, maxWidth: 220 },
  heroShield: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  usageRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 32 },
  usageLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1 },
  usageValue: { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1.5, marginTop: 4 },
  circle: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  circleValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  circleLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 2 },
  heroTrack: { height: 10, borderRadius: 10, overflow: 'hidden', marginTop: 24 },
  heroProgress: { height: '100%', borderRadius: 10 },
  
  attentionList: { gap: 10, marginBottom: 32 },
  attentionItem: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  attentionCopy: { flex: 1 },
  attentionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 4 },
  attentionSub: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  emptyState: { padding: 18, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 14 },

  routineCard: { borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  routineIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  routineCopy: { flex: 1 },
  routineTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  routineSub: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 32, paddingHorizontal: 4 },
  footerText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1, lineHeight: 18 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});