import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useArchiveChild, useCreateChild, useUpdateChild, type ChildProfileAgeBand } from '@workspace/api-client-react';
import { Button, Card, Notice, Screen, SectionTitle } from '@/components/ui';
import { useChildColor } from '@/components/charts';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { AGE_PRESETS, applyAgePreset } from '@/lib/agePresets';
import { showApiError } from '@/lib/apiErrors';

import { goBack } from '@/lib/navigation';
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

function bandFor(birthYear: number): ChildProfileAgeBand {
  const age = new Date().getFullYear() - birthYear;
  if (age <= 9) return 'ate9';
  if (age <= 12) return 'de10a12';
  if (age <= 15) return 'de13a15';
  if (age <= 17) return 'de16a17';
  return 'adulto';
}

export default function ChildEditScreen() {
  const colors = useColors();
  const childColor = useChildColor();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, overview, refetch, selectChild } = useFamily();
  const existing = data.children.find((c) => c.id === id);
  const [name, setName] = useState(existing?.displayName ?? '');
  const [age, setAge] = useState(existing ? String(new Date().getFullYear() - existing.birthYear) : '');
  const [color, setColor] = useState(existing?.color ?? COLORS[data.children.length % COLORS.length]);
  const [usePreset, setUsePreset] = useState(!existing);
  // Aberto por link direto, a criança chega depois do primeiro render.
  useEffect(() => {
    if (!existing) return;
    setName((v) => v || existing.displayName);
    setAge((v) => v || String(new Date().getFullYear() - existing.birthYear));
    setColor(existing.color);
    setUsePreset(false);
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const archiveChild = useArchiveChild();

  const ageNumber = parseInt(age, 10);
  const valid = name.trim().length > 0 && ageNumber >= 1 && ageNumber <= 19;
  const birthYear = new Date().getFullYear() - (Number.isFinite(ageNumber) ? ageNumber : 0);
  const band = useMemo(() => bandFor(birthYear), [birthYear]);
  const preset = AGE_PRESETS[band];
  const limits = data.limits;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      if (existing) {
        await updateChild.mutateAsync({ childId: existing.id, data: { displayName: name.trim(), birthYear, color } });
      } else {
        const child = await createChild.mutateAsync({ data: { displayName: name.trim(), birthYear, color } });
        if (usePreset && band !== 'adulto') await applyAgePreset(child.id, band, overview?.routines ?? []);
        selectChild(child.id);
      }
      refetch();
      goBack('/(app)/(tabs)/profile');
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  };

  const archive = () => {
    if (!existing) return;
    Alert.alert(`Remover ${existing.displayName}?`, 'O perfil é arquivado e todos os aparelhos dele deixam de ser controlados. Os relatórios antigos são mantidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: () => archiveChild.mutate({ childId: existing.id }, {
          onSuccess: () => { refetch(); goBack('/(app)/(tabs)/profile'); },
          onError: (error) => showApiError(error),
        }),
      },
    ]);
  };

  return (
    <Screen back title={existing ? `Editar ${existing.displayName}` : 'Nova criança'}
      subtitle={limits && !existing ? `${limits.children} de ${limits.maxChildren} crianças no plano ${limits.plan === 'premium' ? 'Premium' : 'gratuito'}.` : undefined}>
      <SectionTitle>Nome</SectionTitle>
      <TextInput value={name} onChangeText={setName} maxLength={50} placeholder="Como a criança é chamada"
        placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />

      <SectionTitle>Idade</SectionTitle>
      <TextInput value={age} onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="Ex.: 10"
        placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />

      <SectionTitle>Cor nos gráficos</SectionTitle>
      <View style={styles.colors}>
        {COLORS.map((c, i) => (
          <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="button" accessibilityLabel={`Cor ${i + 1}`}
            accessibilityState={{ selected: c === color }} style={[styles.swatchWrap, { borderColor: c === color ? colors.foreground : 'transparent' }]}>
            <View style={[styles.swatch, { backgroundColor: childColor(c) }]} />
          </Pressable>
        ))}
      </View>

      {!existing && valid && band !== 'adulto' && (
        <>
          <SectionTitle>Sugestão para {preset.label}</SectionTitle>
          <Card style={{ gap: 10 }}>
            <View style={styles.presetHead}>
              <Text style={[styles.presetText, { color: colors.foreground }]}>{preset.summary}</Text>
              <Switch value={usePreset} onValueChange={setUsePreset} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} />
            </View>
            <Text style={[styles.presetDetail, { color: colors.mutedForeground }]}>
              {preset.apps.length} regras de apps e {preset.routines.length} rotinas. Você pode ajustar tudo depois.
            </Text>
          </Card>
        </>
      )}

      <View style={{ height: 24 }} />
      <Notice icon="info">A criança vê no aparelho dela quais regras estão ativas e quais dados são compartilhados (transparência exigida pelo ECA Digital).</Notice>
      <View style={{ height: 16 }} />
      <Button label={existing ? 'Salvar' : 'Adicionar criança'} onPress={save} loading={saving} disabled={!valid} testID="child-save" />
      {existing && data.children.length > 1 && (
        <Button label="Remover perfil" variant="destructive" onPress={archive} style={{ marginTop: 12 }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontFamily: 'Inter_500Medium', fontSize: 16 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchWrap: { borderWidth: 2, borderRadius: 22, padding: 3 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  presetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  presetText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  presetDetail: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
