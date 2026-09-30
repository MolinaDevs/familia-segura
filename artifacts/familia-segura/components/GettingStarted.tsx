import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FamilyOverview } from '@workspace/api-client-react';
import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

type Step = { key: string; done: boolean; title: string; detail: string; icon: IconName; go?: () => void };

/**
 * Guia "Primeiros passos" do painel: o que falta para a proteção funcionar de verdade, em ordem, com
 * progresso. Some sozinho quando tudo está pronto. Cada passo abre a tela certa.
 */
export function GettingStarted({ overview, childName, timedApps }: { overview?: FamilyOverview; childName: string; timedApps: number }) {
  const colors = useColors();
  if (!overview) return null;
  const devices = overview.devices;
  const firstDevice = devices[0];
  const steps: Step[] = [
    {
      key: 'pin', done: overview.settings.hasGuardianPin, icon: 'key',
      title: 'Criar o PIN do responsável',
      detail: 'Sem ele, a criança pode desligar ou apagar o app.',
      go: () => router.push('/(app)/settings'),
    },
    {
      key: 'device', done: devices.length > 0, icon: 'smartphone',
      title: `Conectar o celular de ${childName}`,
      detail: 'Gere um código aqui e digite no aparelho da criança.',
      go: () => router.push('/(app)/pair-device'),
    },
    {
      key: 'protection', done: devices.some((d) => d.protectionState === 'active'), icon: 'shield',
      title: 'Ativar a proteção no aparelho',
      detail: firstDevice
        ? 'No aparelho da criança: Área do responsável → Configurar a proteção.'
        : 'Depois de conectar o aparelho.',
      go: firstDevice ? () => router.push({ pathname: '/(app)/device/[id]', params: { id: firstDevice.id } }) : undefined,
    },
    {
      key: 'apps', done: timedApps > 1, icon: 'grid',
      title: 'Escolher os apps e os limites',
      detail: 'Já começamos pelo YouTube. Adicione os jogos e redes que ela usa.',
      go: () => router.push('/(app)/add-app'),
    },
    {
      key: 'routine', done: overview.routines.length > 1, icon: 'moon',
      title: 'Conferir as rotinas',
      detail: 'Hora de dormir já vem pronta; que tal a hora da escola?',
      go: () => router.push('/(app)/(tabs)/routine'),
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <Card style={styles.card} testID="getting-started">
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Primeiros passos</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{done} de {steps.length} prontos · leva uns 10 minutos</Text>
        </View>
        <Pressable onPress={() => router.push('/(app)/welcome-tour')} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.link, { color: colors.primary }]}>Ver o tour</Text>
        </Pressable>
      </View>
      <View style={[styles.track, { backgroundColor: colors.muted }]}>
        <View style={[styles.fill, { width: `${Math.round((done / steps.length) * 100)}%`, backgroundColor: colors.success }]} />
      </View>
      {steps.map((step) => {
        const current = step.key === next?.key;
        return (
          <Pressable
            key={step.key}
            accessibilityRole="button"
            accessibilityState={{ disabled: step.done || !step.go }}
            disabled={step.done || !step.go}
            onPress={step.go}
            style={({ pressed }) => [styles.row, current && { backgroundColor: colors.secondary }, pressed && { opacity: 0.8 }]}
            testID={`step-${step.key}`}
          >
            <View style={[styles.icon, { backgroundColor: step.done ? colors.successSoft : current ? colors.card : colors.muted }]}>
              <Icon name={step.done ? 'check' : step.icon} size={18} color={step.done ? colors.success : current ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: step.done ? colors.mutedForeground : colors.foreground }, step.done && styles.doneText]}>{step.title}</Text>
              {!step.done ? <Text style={[styles.stepDetail, { color: colors.mutedForeground }]}>{step.detail}</Text> : null}
            </View>
            {!step.done && step.go ? <Icon name="chevron-right" size={16} color={current ? colors.primary : colors.mutedForeground} /> : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 17 },
  subtitle: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 12.5, marginTop: 2 },
  link: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 13 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, minHeight: 48 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 14.5 },
  stepDetail: { fontFamily: 'NunitoSans_500Medium', fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  doneText: { textDecorationLine: 'line-through' },
});
