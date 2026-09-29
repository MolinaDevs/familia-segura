import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getListCatalogAppsQueryKey, useCreateAppRule, useListCatalogApps, type CatalogApp } from '@workspace/api-client-react';
import { AppIcon } from '@/components/AppIcon';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { Button, Card, Chip, Notice, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

import { goBack } from '@/lib/navigation';
const LIMITS = [0, 15, 30, 45, 60, 90, 120];

export default function AddAppScreen() {
  const colors = useColors();
  const { data, refetch } = useFamily();
  const catalog = useListCatalogApps({ query: { queryKey: getListCatalogAppsQueryKey(), staleTime: 5 * 60_000 } });
  const createRule = useCreateAppRule();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogApp | null>(null);
  const [limit, setLimit] = useState(60);

  const already = new Set(data.apps.map((a) => a.id));
  const categories = useMemo(() => [...new Set((catalog.data ?? []).map((a) => a.category))], [catalog.data]);
  const list = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (catalog.data ?? []).filter((app) =>
      (!category || app.category === category)
      && (!term || app.name.toLocaleLowerCase('pt-BR').includes(term)));
  }, [catalog.data, search, category]);

  const save = () => {
    if (!selected || !data.childId) return;
    createRule.mutate({
      childId: data.childId,
      data: { catalogAppId: selected.id, name: selected.name, dailyLimitMinutes: limit, status: limit === 0 ? 'blocked' : 'allowed' },
    }, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetch();
        setSelected(null);
        goBack('/(app)/(tabs)/apps');
      },
      onError: (error) => showApiError(error),
    });
  };

  if (selected) {
    return (
      <Screen back title={selected.name} subtitle={`Regra para ${data.childName}. Vale em todos os aparelhos de ${data.childName}.`}>
        <View style={{ alignItems: 'center', marginVertical: 20 }}><AppIcon name={selected.icon} color={selected.iconColor} size={64} /></View>
        <SectionTitle>Limite diário</SectionTitle>
        <View style={styles.chips}>
          {LIMITS.map((value) => (
            <Chip key={value} label={value === 0 ? 'Bloquear' : `${value} min`} selected={limit === value} onPress={() => setLimit(value)} />
          ))}
        </View>
        <View style={{ height: 20 }} />
        {data.devices.some((d) => d.platform === 'ios') && (
          <View style={{ marginBottom: 16 }}>
            <Notice icon="smartphone">No iPhone/iPad, depois de salvar, associe o app na Área do responsável do aparelho (a Apple exige a escolha no próprio aparelho).</Notice>
          </View>
        )}
        <Button label="Salvar regra" onPress={save} loading={createRule.isPending} testID="add-app-save" />
        <Button label="Escolher outro app" variant="ghost" onPress={() => setSelected(null)} style={{ marginTop: 8 }} />
      </Screen>
    );
  }

  return (
    <Screen back title="Adicionar app" subtitle="Escolha do catálogo ou dos apps encontrados nos aparelhos Android.">
      <View style={{ height: 16 }} />
      <ChildSwitcher />
      <TextInput value={search} onChangeText={setSearch} placeholder="Buscar app" placeholderTextColor={colors.mutedForeground}
        style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
      <View style={[styles.chips, { marginTop: 12 }]}>
        <Chip label="Todos" selected={!category} onPress={() => setCategory(null)} />
        {categories.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>
      <View style={{ height: 12 }} />
      {catalog.isLoading && <ActivityIndicator color={colors.primary} />}
      <Card style={{ paddingVertical: 4 }}>
        {list.map((app, index) => {
          const has = already.has(app.id);
          return (
            <Pressable key={app.id} disabled={has} onPress={() => setSelected(app)} testID={`catalog-${app.id}`}
              style={({ pressed }) => [styles.item, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}>
              <AppIcon name={app.icon} color={app.iconColor} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{app.name}</Text>
                <Text style={[styles.cat, { color: colors.mutedForeground }]}>{app.category}</Text>
              </View>
              <Text style={[styles.cat, { color: has ? colors.success : colors.primary }]}>{has ? 'Já tem regra' : 'Adicionar'}</Text>
            </Pressable>
          );
        })}
        {!catalog.isLoading && list.length === 0 && <Text style={[styles.cat, { color: colors.mutedForeground, padding: 16, textAlign: 'center' }]}>Nenhum app encontrado.</Text>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontFamily: 'Inter_500Medium', fontSize: 15 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  cat: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
