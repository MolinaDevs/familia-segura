import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePauseChild, useResumeChild } from '@workspace/api-client-react';
import { Icon } from '@/components/Icon';
import { Button, Card, Chip } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

const OPTIONS: Array<{ label: string; minutes: number }> = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: 'Até eu liberar', minutes: 0 },
];

/**
 * "até 18:30", ou "até liberar" para pausas longas (o servidor usa 30 dias como "até liberar").
 * `reader`: quem lê — o responsável ("até você liberar") ou a criança ("até sua família liberar").
 */
export function pauseLabel(until: string | Date, reader: 'guardian' | 'child' = 'guardian') {
  const date = new Date(until);
  if (date.getTime() - Date.now() > 24 * 3600_000) return reader === 'child' ? 'até sua família liberar' : 'até você liberar';
  return `até ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Pausar agora: todos os apps da criança param na hora, em todos os aparelhos dela.
 * Ligações, emergência e despertador continuam. Recurso grátis: é segurança, não conforto.
 */
export function PauseCard({ childId, childName, pausedUntil, canEdit, onChanged }: {
  childId: string; childName: string; pausedUntil?: string | null; canEdit: boolean; onChanged: () => void;
}) {
  const colors = useColors();
  const pause = usePauseChild();
  const resume = useResumeChild();
  const paused = Boolean(pausedUntil && new Date(pausedUntil).getTime() > Date.now());

  const pauseFor = (minutes: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pause.mutate({ childId, data: { minutes } }, { onSuccess: onChanged, onError: (e) => showApiError(e) });
  };
  const release = () => {
    void Haptics.selectionAsync();
    resume.mutate({ childId }, { onSuccess: onChanged, onError: (e) => showApiError(e) });
  };

  if (paused && pausedUntil) {
    return (
      <Card style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.secondary }]} testID="pause-card-active">
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.card }]}>
            <Icon name="pause" size={24} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Apps de {childName} em pausa</Text>
            <Text style={[styles.detail, { color: colors.mutedForeground }]}>
              {pauseLabel(pausedUntil).replace(/^./, (c) => c.toUpperCase())}. Ligações, emergência e despertador continuam.
            </Text>
          </View>
        </View>
        {canEdit ? <Button label="Liberar agora" icon="resume" onPress={release} loading={resume.isPending} testID="pause-release" /> : null}
      </Card>
    );
  }

  if (!canEdit) return null;
  return (
    <Card style={styles.card} testID="pause-card">
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.blueSoft }]}>
          <Icon name="pause" size={24} color={colors.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Pausar os apps de {childName}</Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>Na hora, em todos os aparelhos. Ligações e emergência continuam.</Text>
        </View>
      </View>
      <View style={styles.chips}>
        {OPTIONS.map((option) => (
          <Chip key={option.label} label={option.label} onPress={() => pauseFor(option.minutes)} testID={`pause-${option.minutes}`} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 15.5 },
  detail: { fontFamily: 'NunitoSans_500Medium', fontSize: 13, lineHeight: 18, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
