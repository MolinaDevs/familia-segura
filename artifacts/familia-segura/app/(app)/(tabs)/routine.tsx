import { Icon, iconName } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { Button, Card, EmptyState, Notice, Screen, SectionTitle, Toggle } from '@/components/ui';
import { PlanUsage } from '@/components/PlanHint';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { TipCard } from '@/components/TipCard';

const DAY_LABELS: Record<string, string> = { dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb' };
const formatDays = (days: string) => {
  const list = days.split(',').filter(Boolean);
  if (list.length === 7) return 'Todos os dias';
  if (list.join(',') === 'seg,ter,qua,qui,sex') return 'Dias de semana';
  return list.map((d) => DAY_LABELS[d] ?? d).join(', ');
};

export default function RoutineScreen() {
  const colors = useColors();
  const { data, toggleRoutine, canEdit, refetch } = useFamily();

  return (
    <Screen tabs eyebrow="Pausas e rotinas" title="Equilíbrio digital" onRefresh={refetch}
      subtitle="Durante uma rotina os apps ficam em pausa. Ligações, emergência e o despertador continuam funcionando.">
      <View style={{ height: 16 }} />
      <ChildSwitcher />
      {data.devices.length === 0 && <View style={{ marginBottom: 12 }}><Notice icon="smartphone" tone="warning">Pareie o aparelho de {data.childName} para as rotinas terem efeito.</Notice></View>}

      <TipCard id="routine" icon="moon" title="Rotina é pausa com hora marcada">
        Nos horários da rotina todos os apps param, menos ligações, emergência e despertador. Para uma pausa agora, use o botão no painel.
      </TipCard>
      <SectionTitle action={canEdit ? '+ Nova rotina' : undefined} onAction={() => router.push('/(app)/routine-edit')}>Rotinas de {data.childName}</SectionTitle>
      <PlanUsage plan={data.limits?.plan} used={data.routines.length} max={data.limits?.maxRoutines} label="rotinas" />
      {data.limits?.plan === 'free' ? <View style={{ height: 12 }} /> : null}
      {data.routines.length === 0 && (
        <EmptyState icon="moon" title="Nenhuma rotina" detail="Crie pausas para dormir, estudar ou comer em família."
          action={canEdit ? <Button label="Criar rotina" onPress={() => router.push('/(app)/routine-edit')} style={{ alignSelf: 'stretch', marginTop: 8 }} /> : undefined} />
      )}
      <View style={{ gap: 12 }}>
        {data.routines.map((routine) => (
          <Card key={routine.id} onPress={canEdit ? () => router.push({ pathname: '/(app)/routine-edit', params: { id: routine.id } }) : undefined}>
            <View style={styles.top}>
              <View style={[styles.icon, { backgroundColor: routine.enabled ? colors.primary : colors.muted }]}>
                <Icon name={iconName(routine.icon, 'clock')} size={20} color={routine.enabled ? colors.primaryForeground : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]}>{routine.title}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>{routine.start} às {routine.end} · {formatDays(routine.days)}{routine.lockScreen ? ' · trava a tela' : ''}</Text>
              </View>
              <Toggle
                testID={`routine-toggle-${routine.id}`}
                accessibilityLabel={`${routine.enabled ? 'Pausar' : 'Ativar'} ${routine.title}`}
                disabled={!canEdit}
                value={routine.enabled}
                onValueChange={() => { void Haptics.selectionAsync(); toggleRoutine(routine.id); }}
              />
            </View>
          </Card>
        ))}
      </View>

      <View style={{ height: 20 }} />
      <Notice icon="eye">As rotinas aparecem no aparelho de {data.childName}. Combinar os horários junto com a criança ajuda a construir confiança.</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  meta: { fontFamily: 'NunitoSans_500Medium', fontSize: 13, marginTop: 3 },
});
