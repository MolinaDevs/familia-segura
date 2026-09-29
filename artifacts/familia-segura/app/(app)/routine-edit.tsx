import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateRoutine, useDeleteRoutine, useUpdateRoutine } from '@workspace/api-client-react';
import { Button, Chip, Notice, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

import { goBack } from '@/lib/navigation';
const DAYS = [
  { key: 'dom', label: 'D' }, { key: 'seg', label: 'S' }, { key: 'ter', label: 'T' }, { key: 'qua', label: 'Q' },
  { key: 'qui', label: 'Q' }, { key: 'sex', label: 'S' }, { key: 'sab', label: 'S' },
];
const DAY_NAMES: Record<string, string> = { dom: 'domingo', seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sábado' };
const TEMPLATES = [
  { title: 'Hora de dormir', icon: 'moon', startTime: '21:00', endTime: '07:00', days: ['dom', 'seg', 'ter', 'qua', 'qui'] },
  { title: 'Escola', icon: 'book', startTime: '07:00', endTime: '12:00', days: ['seg', 'ter', 'qua', 'qui', 'sex'] },
  { title: 'Refeição em família', icon: 'coffee', startTime: '19:00', endTime: '20:00', days: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] },
  { title: 'Lição de casa', icon: 'edit-3', startTime: '14:00', endTime: '16:00', days: ['seg', 'ter', 'qua', 'qui', 'sex'] },
];
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export default function RoutineEditScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, refetch } = useFamily();
  const existing = data.routines.find((r) => r.id === id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'clock');
  const [start, setStart] = useState(existing?.start ?? '21:00');
  const [end, setEnd] = useState(existing?.end ?? '07:00');
  const [days, setDays] = useState<string[]>(existing ? existing.days.split(',') : ['seg', 'ter', 'qua', 'qui', 'sex']);
  // Aberto por link direto, a rotina chega depois do primeiro render.
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title); setIcon(existing.icon || 'clock'); setStart(existing.start); setEnd(existing.end);
    setDays(existing.days.split(','));
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();

  const valid = title.trim().length > 0 && TIME_RE.test(start) && TIME_RE.test(end) && start !== end && days.length > 0;
  const ordered = DAYS.map((d) => d.key).filter((d) => days.includes(d));
  const crossesMidnight = TIME_RE.test(start) && TIME_RE.test(end) && end < start;

  const toggleDay = (key: string) => setDays((current) => current.includes(key) ? current.filter((d) => d !== key) : [...current, key]);
  const done = { onSuccess: () => { refetch(); goBack('/(app)/(tabs)/routine'); }, onError: (error: unknown) => showApiError(error) };

  const save = () => {
    if (!valid || !data.childId) return;
    const payload = { title: title.trim(), icon, startTime: start, endTime: end, days: ordered.join(',') };
    if (existing) updateRoutine.mutate({ routineId: existing.id, data: payload }, done);
    else createRoutine.mutate({ childId: data.childId, data: { ...payload, description: '', enabled: true } }, done);
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Excluir rotina?', `"${existing.title}" deixará de pausar os aparelhos de ${data.childName}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteRoutine.mutate({ routineId: existing.id }, done) },
    ]);
  };

  return (
    <Screen back title={existing ? 'Editar rotina' : 'Nova rotina'} subtitle={`Para ${data.childName}. Durante a rotina, só ligações e emergência ficam liberadas.`}>
      {!existing && (
        <>
          <SectionTitle>Modelos</SectionTitle>
          <View style={styles.wrap}>
            {TEMPLATES.map((t) => (
              <Chip key={t.title} label={t.title} selected={title === t.title}
                onPress={() => { setTitle(t.title); setIcon(t.icon); setStart(t.startTime); setEnd(t.endTime); setDays(t.days); }} />
            ))}
          </View>
        </>
      )}

      <SectionTitle>Nome</SectionTitle>
      <TextInput value={title} onChangeText={setTitle} maxLength={80} placeholder="Ex.: Hora de dormir" placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />

      <SectionTitle>Dias</SectionTitle>
      <View style={styles.days}>
        {DAYS.map((d) => (
          <View key={d.key} accessible accessibilityLabel={DAY_NAMES[d.key]} style={{ flex: 1 }}>
            <Chip label={d.label} selected={days.includes(d.key)} onPress={() => toggleDay(d.key)} />
          </View>
        ))}
      </View>

      <SectionTitle>Horário</SectionTitle>
      <View style={styles.times}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Começa</Text>
          <TextInput value={start} onChangeText={(v) => setStart(formatTimeInput(v))} keyboardType="number-pad" maxLength={5}
            style={[styles.input, styles.time, { borderColor: TIME_RE.test(start) ? colors.border : colors.destructive, backgroundColor: colors.card, color: colors.foreground }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Termina</Text>
          <TextInput value={end} onChangeText={(v) => setEnd(formatTimeInput(v))} keyboardType="number-pad" maxLength={5}
            style={[styles.input, styles.time, { borderColor: TIME_RE.test(end) ? colors.border : colors.destructive, backgroundColor: colors.card, color: colors.foreground }]} />
        </View>
      </View>
      {crossesMidnight && <Text style={[styles.hint, { color: colors.mutedForeground }]}>Atravessa a meia-noite: termina no dia seguinte.</Text>}

      <View style={{ height: 20 }} />
      {data.devices.length === 0 && <View style={{ marginBottom: 12 }}><Notice icon="smartphone" tone="warning">Pareie um aparelho para a rotina ter efeito.</Notice></View>}
      <Button label="Salvar rotina" onPress={save} disabled={!valid} loading={createRoutine.isPending || updateRoutine.isPending} testID="routine-save" />
      {existing && <Button label="Excluir rotina" variant="destructive" onPress={remove} style={{ marginTop: 12 }} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  days: { flexDirection: 'row', gap: 6 },
  times: { flexDirection: 'row', gap: 12 },
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontFamily: 'Inter_500Medium', fontSize: 16 },
  time: { textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 20 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 6 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 8 },
});
