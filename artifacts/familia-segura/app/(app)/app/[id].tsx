import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { useDeleteAppRule } from '@workspace/api-client-react';
import { AppIcon } from '@/components/AppIcon';
import { StatusPill } from '@/components/StatusPill';
import { Button, Card, Chip, EmptyState, Notice, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

import { goBack } from '@/lib/navigation';
const LIMITS = [15, 30, 45, 60, 90, 120, 180];

export default function AppDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setAppLimit, addExtraTime, toggleApp, canEdit, refetch } = useFamily();
  const deleteRule = useDeleteAppRule();
  const app = data.apps.find((item) => item.id === id);

  if (!app) {
    return (
      <Screen back>
        <EmptyState icon="alert-circle" title="Regra não encontrada" detail={`Este app não tem mais regra para ${data.childName}.`} />
      </Screen>
    );
  }
  const percent = app.effectiveLimit ? Math.min(100, Math.round((app.usageToday / app.effectiveLimit) * 100)) : 0;
  const blocked = app.status === 'bloqueado';

  const remove = () => Alert.alert(`Remover regra de ${app.name}?`, 'O app deixa de ter limite e bloqueio para esta criança.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Remover', style: 'destructive', onPress: () => data.childId && deleteRule.mutate({ childId: data.childId, appId: app.id }, {
        onSuccess: () => { refetch(); goBack('/(app)/(tabs)/apps'); },
        onError: (error) => showApiError(error),
      }),
    },
  ]);

  return (
    <Screen back>
      <View style={styles.hero}>
        <AppIcon name={app.icon} color={app.iconColor} size={64} />
        <Text accessibilityRole="header" style={[styles.name, { color: colors.foreground }]}>{app.name}</Text>
        <Text style={[styles.category, { color: colors.mutedForeground }]}>{app.category} · {data.childName}</Text>
        <View style={{ marginTop: 10 }}><StatusPill status={app.status} /></View>
      </View>

      <Card>
        <View style={styles.usageHead}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>USO DE HOJE</Text>
          <Text style={[styles.usage, { color: colors.foreground }]}>{app.usageToday} min</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.muted }]}>
          <View style={[styles.progress, { width: `${percent}%`, backgroundColor: percent >= 100 ? colors.destructive : colors.primary }]} />
        </View>
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          {blocked ? 'Bloqueado' : `Limite diário: ${app.dailyLimit} min`}{app.extraToday ? ` · +${app.extraToday} min liberados só hoje` : ''}
        </Text>
      </Card>

      {!canEdit && <View style={{ marginTop: 16 }}><Notice icon="eye">Você é observador desta família: pode acompanhar, mas não alterar regras.</Notice></View>}

      {canEdit && (
        <>
          <SectionTitle>Limite diário</SectionTitle>
          <View style={styles.chips}>
            {LIMITS.map((option) => (
              <Chip key={option} testID={`limit-${option}`} label={`${option} min`} selected={!blocked && app.dailyLimit === option}
                onPress={() => { void Haptics.selectionAsync(); setAppLimit(app.id, option); }} />
            ))}
          </View>

          <Button testID="block-app" label={blocked ? 'Permitir aplicativo' : 'Bloquear aplicativo'} icon={blocked ? 'unlock' : 'slash'}
            variant={blocked ? 'secondary' : 'destructive'} onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleApp(app.id); }}
            style={{ marginTop: 18 }} />

          <SectionTitle>Tempo extra só hoje</SectionTitle>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>Libera minutos até a meia-noite, sem mudar o limite diário.</Text>
          <View style={[styles.chips, { marginTop: 10 }]}>
            {[15, 30, 60].map((minutes) => (
              <Chip key={minutes} testID={`extra-${minutes}`} label={`+${minutes} min`} onPress={() => { void Haptics.selectionAsync(); addExtraTime(app.id, minutes); }} />
            ))}
          </View>

          <Button label="Remover regra" variant="ghost" onPress={remove} style={{ marginTop: 28 }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 24 },
  name: { fontFamily: 'Montserrat_700Bold', fontSize: 25, letterSpacing: -0.6, marginTop: 12 },
  category: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, marginTop: 4 },
  usageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.2 },
  usage: { fontFamily: 'Montserrat_700Bold', fontSize: 26, letterSpacing: -0.7 },
  track: { height: 9, borderRadius: 99, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 99 },
  footer: { fontFamily: 'NunitoSans_500Medium', fontSize: 12, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  helper: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 19 },
});
