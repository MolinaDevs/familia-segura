import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getGetUsageReportQueryKey, useGetUsageReport } from '@workspace/api-client-react';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { DailyUsageChart, RankBars, StatTile, UsageHeatmap, useChildColor } from '@/components/charts';
import { Button, Card, Chip, EmptyState, formatMinutes, Notice, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { TipCard } from '@/components/TipCard';
import { AdSlot } from '@/components/ads/AdSlot';
import { apiStatus } from '@/lib/apiErrors';

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '3 meses' },
];

const STATE_LABEL: Record<string, string> = {
  active: 'Proteção ativa', partial: 'Proteção parcial', disabled: 'Proteção desligada', unavailable: 'Sem suporte', unknown: 'Aguardando aparelho',
};

export default function ReportsScreen() {
  const colors = useColors();
  const childColor = useChildColor();
  const { data } = useFamily();
  const [childId, setChildId] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const params = { days, ...(childId ? { childId } : {}) };
  const report = useGetUsageReport(params, { query: { queryKey: getGetUsageReportQueryKey(params), staleTime: 60_000, retry: false } });
  const needsPremium = apiStatus(report.error) === 402;
  const r = report.data;

  const delta = r && r.totals.previousPeriodMinutes > 0
    ? Math.round(((r.totals.minutes - r.totals.previousPeriodMinutes) / r.totals.previousPeriodMinutes) * 100)
    : null;

  return (
    <Screen tabs eyebrow="Relatórios" title="Uso da família" refreshing={report.isRefetching} onRefresh={() => void report.refetch()}>
      <View style={{ height: 16 }} />
      <ChildSwitcher value={childId} onChange={setChildId} allowAll />
      <TipCard id="reports" icon="bar-chart-2" title="Lendo os relatórios">
        Os números juntam todos os aparelhos da criança. Toque num dia do gráfico para ver o total, e compare com a linha do limite.
      </TipCard>
      <View style={styles.periods}>
        {PERIODS.map((p) => <Chip key={p.days} label={p.label} selected={days === p.days} onPress={() => setDays(p.days)} />)}
      </View>
      {data.limits?.plan === 'free' && !needsPremium ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/subscription')} style={{ marginBottom: 12 }}>
          <Notice icon="star">No Premium: resumo da semana no celular todo domingo e 12 meses de histórico.</Notice>
        </Pressable>
      ) : null}

      {report.isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />}

      {needsPremium && (
        <EmptyState icon="bar-chart-2" title="Histórico longo é Premium" detail="No plano grátis você vê os últimos 7 dias. O Premium guarda 12 meses e manda o resumo da semana no seu celular."
          action={<Button label="Ver planos" onPress={() => router.push('/(app)/subscription')} style={{ marginTop: 8, alignSelf: 'stretch' }} />} />
      )}

      {report.isError && !needsPremium && (
        <EmptyState icon="wifi-off" title="Não foi possível carregar" detail="Puxe para baixo para tentar de novo." />
      )}

      {r && (
        <>
          {r.precision === 'none' ? (
            <EmptyState icon="activity" title="Ainda sem dados de uso" detail="Os gráficos aparecem assim que um aparelho pareado enviar o primeiro uso." />
          ) : (
            <>
              {(r.precision === 'estimated' || r.precision === 'mixed') && (
                <View style={{ marginBottom: 12 }}>
                  <Notice icon="info">Dados de iPhone/iPad são aproximados: a Apple só informa faixas de uso (por exemplo, passou de 30 min).</Notice>
                </View>
              )}
              <View style={styles.stats}>
                <StatTile label="Total no período" value={formatMinutes(r.totals.minutes)}
                  delta={delta === null ? undefined : { text: `${delta > 0 ? '+' : ''}${delta}% vs. período anterior`, good: delta <= 0 }} />
                <StatTile label="Média por dia" value={formatMinutes(r.totals.dailyAverage)} />
              </View>

              <SectionTitle>Tempo de tela por dia</SectionTitle>
              <Card><DailyUsageChart days={r.daily} /></Card>

              <SectionTitle>Apps mais usados</SectionTitle>
              <Card>
                <RankBars emptyText="Nenhum app com uso no período."
                  items={r.apps.slice(0, 8).map((a) => ({ key: a.appId, label: a.appName, minutes: a.minutes, note: a.precision === 'estimated' ? 'aproximado' : undefined }))} />
              </Card>

              <SectionTitle>Horários de uso</SectionTitle>
              <Card><UsageHeatmap cells={r.heatmap} /></Card>

              {!childId && r.children.length > 1 && (
                <>
                  <SectionTitle>Comparação entre crianças</SectionTitle>
                  <Card>
                    <RankBars emptyText="Sem uso no período."
                      items={r.children.map((c) => ({ key: c.childId, label: c.name, minutes: c.minutes, color: childColor(c.color) }))} />
                  </Card>
                </>
              )}

              {r.devices.length > 0 && (
                <>
                  <SectionTitle>Por aparelho</SectionTitle>
                  <Card>
                    <RankBars emptyText="Sem uso no período."
                      items={r.devices.map((d) => ({ key: d.deviceId, label: `${d.name} · ${d.platform === 'ios' ? 'iPhone/iPad' : 'Android'}`, minutes: d.minutes }))} />
                  </Card>
                </>
              )}
            </>
          )}

          <SectionTitle>Combinados</SectionTitle>
          <View style={styles.stats}>
            <StatTile label="Limites atingidos" value={String(r.compliance.limitsReached)} />
            <StatTile label="Tempo extra liberado" value={formatMinutes(r.compliance.extraMinutesGranted)} />
          </View>
          <View style={[styles.stats, { marginTop: 10 }]}>
            <StatTile label="Pedidos aprovados" value={`${r.compliance.requestsApproved}/${r.compliance.requestsCreated}`} />
            <StatTile label="Pedidos negados" value={String(r.compliance.requestsDenied)} />
          </View>

          {r.protection.length > 0 && (
            <>
              <SectionTitle>Saúde da proteção</SectionTitle>
              <Card style={{ gap: 12 }}>
                {r.protection.map((p) => (
                  <View key={p.deviceId} style={styles.protRow}>
                    <View style={[styles.dot, { backgroundColor: p.state === 'active' ? colors.success : p.state === 'partial' ? colors.warning : colors.destructive }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.protName, { color: colors.foreground }]}>{p.name}</Text>
                      <Text style={[styles.protDetail, { color: colors.mutedForeground }]}>
                        {STATE_LABEL[p.state] ?? p.state} · visto {new Date(p.lastSeenAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        {p.tamperEvents > 0 ? ` · ${p.tamperEvents} tentativa(s) de adulteração` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}
          {data.children.length === 0 && <Text style={{ color: colors.mutedForeground }}>Nenhuma criança cadastrada.</Text>}
        </>
      )}
      <AdSlot />
    </Screen>
  );
}

const styles = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  stats: { flexDirection: 'row', gap: 10 },
  protRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  protName: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  protDetail: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
});
