import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { StatusPill } from '@/components/StatusPill';
import { Button, Card, EmptyState, Notice, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { PlanUsage } from '@/components/PlanHint';

export default function AppsScreen() {
  const colors = useColors();
  const { data, canEdit, refetch, overview } = useFamily();
  const sortedApps = useMemo(() => [...data.apps].sort((a, b) => b.usageToday - a.usageToday), [data.apps]);
  const settings = overview?.settings;

  return (
    <Screen tabs eyebrow="Controle de apps" title="Aplicativos" onRefresh={refetch}>
      <View style={{ height: 16 }} />
      <ChildSwitcher />

      {settings && (
        <Card style={{ gap: 6 }} onPress={canEdit ? () => router.push('/(app)/settings') : undefined}>
          <Text style={[styles.protTitle, { color: colors.foreground }]}>Proteções do aparelho</Text>
          <Text style={[styles.protItem, { color: colors.mutedForeground }]}>
            {settings.blockAppInstalls ? '✓ Instalar apps exige sua liberação' : '• Instalação de apps liberada'}
          </Text>
          <Text style={[styles.protItem, { color: colors.mutedForeground }]}>
            {settings.blockAppRemoval ? '✓ Apagar apps exige sua liberação' : '• Remoção de apps liberada'}
          </Text>
          <Text style={[styles.protItem, { color: colors.mutedForeground }]}>
            {settings.quarantineNewApps ? '✓ Apps novos ficam bloqueados até você aprovar (Android)' : '• Apps novos liberados automaticamente'}
          </Text>
        </Card>
      )}

      <SectionTitle action={canEdit ? '+ Adicionar' : undefined} onAction={() => router.push('/(app)/add-app')}>Regras de {data.childName}</SectionTitle>
      <PlanUsage plan={data.limits?.plan} used={data.apps.filter((a) => a.status !== 'bloqueado').length}
        max={data.limits?.maxTimedApps} label="apps com limite de tempo" />
      {data.limits?.plan === 'free' ? <View style={{ height: 12 }} /> : null}
      {sortedApps.length === 0 ? (
        <EmptyState icon="grid" title="Nenhum app com regra" detail="Escolha os apps que precisam de limite ou bloqueio."
          action={canEdit ? <Button label="Adicionar app" onPress={() => router.push('/(app)/add-app')} style={{ alignSelf: 'stretch', marginTop: 8 }} /> : undefined} />
      ) : (
        <View style={{ gap: 12 }}>
          {sortedApps.map((item) => {
            const percent = item.effectiveLimit ? Math.min(100, Math.round((item.usageToday / item.effectiveLimit) * 100)) : 0;
            return (
              <Card key={item.id} testID={`app-row-${item.id}`} onPress={() => router.push({ pathname: '/app/[id]', params: { id: item.id } })}>
                <View style={styles.top}>
                  <AppIcon name={item.icon} color={item.iconColor} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.category, { color: colors.mutedForeground }]}>{item.category}</Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>
                <View style={styles.usageLine}>
                  <Text style={[styles.usage, { color: colors.foreground }]}>{item.usageToday} min hoje</Text>
                  <Text style={[styles.limit, { color: colors.mutedForeground }]}>
                    {item.status === 'bloqueado' ? (item.extraToday ? `+${item.extraToday} min liberados hoje` : 'bloqueado') : `limite ${item.dailyLimit} min${item.extraToday ? ` +${item.extraToday}` : ''}`}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: colors.muted }]}>
                  <View style={[styles.progress, { width: `${percent}%`, backgroundColor: percent >= 100 ? colors.destructive : percent >= 80 ? colors.warning : colors.primary }]} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
      {data.devices.some((d) => d.platform === 'ios') && sortedApps.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Notice icon="smartphone">iPhone/iPad: cada regra nova precisa ser associada ao app no próprio aparelho (Área do responsável → Configurar a proteção).</Notice>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  protTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, marginBottom: 2 },
  protItem: { fontFamily: 'NunitoSans_500Medium', fontSize: 13 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  category: { fontFamily: 'NunitoSans_500Medium', fontSize: 13, marginTop: 2 },
  usageLine: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  usage: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13 },
  limit: { fontFamily: 'NunitoSans_500Medium', fontSize: 13 },
  track: { height: 8, borderRadius: 8, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 8 },
});
