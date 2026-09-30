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
const CUSTOM_CATEGORIES = ['Jogos', 'Vídeo', 'Redes sociais', 'Mensagens', 'Educação', 'Outros'];
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;

export default function AddAppScreen() {
  const colors = useColors();
  const { data, refetch } = useFamily();
  const catalog = useListCatalogApps({ query: { queryKey: getListCatalogAppsQueryKey(), staleTime: 5 * 60_000 } });
  const createRule = useCreateAppRule();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogApp | null>(null);
  const [limit, setLimit] = useState(60);
  // App fora do catálogo (qualquer app que o responsável quiser limitar).
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Outros');
  const [customPackage, setCustomPackage] = useState('');

  const already = new Set(data.apps.map((a) => a.id));
  const categories = useMemo(() => [...new Set((catalog.data ?? []).map((a) => a.category))], [catalog.data]);
  const list = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (catalog.data ?? []).filter((app) =>
      (!category || app.category === category)
      && (!term || app.name.toLocaleLowerCase('pt-BR').includes(term)));
  }, [catalog.data, search, category]);

  const packageValid = !customPackage.trim() || PACKAGE_RE.test(customPackage.trim());
  const save = () => {
    if (!data.childId || (!selected && !custom)) return;
    if (custom && (!customName.trim() || !packageValid)) return;
    const status = limit === 0 ? 'blocked' as const : 'allowed' as const;
    const payload = custom
      ? { name: customName.trim(), category: customCategory, androidPackages: customPackage.trim() ? [customPackage.trim()] : [], dailyLimitMinutes: limit, status }
      : { catalogAppId: selected!.id, name: selected!.name, dailyLimitMinutes: limit, status };
    createRule.mutate({ childId: data.childId, data: payload }, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetch();
        setSelected(null);
        setCustom(false);
        goBack('/(app)/(tabs)/apps');
      },
      onError: (error) => showApiError(error),
    });
  };

  if (custom) {
    return (
      <Screen back title="Outro app" subtitle={`Regra para ${data.childName}, para um app que não está na lista.`}>
        <SectionTitle>Nome do app</SectionTitle>
        <TextInput value={customName} onChangeText={setCustomName} maxLength={80} placeholder="Ex.: Jogo da escola"
          placeholderTextColor={colors.mutedForeground} testID="custom-app-name"
          style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
        <SectionTitle>Categoria</SectionTitle>
        <View style={styles.chips}>
          {CUSTOM_CATEGORIES.map((c) => <Chip key={c} label={c} selected={customCategory === c} onPress={() => setCustomCategory(c)} />)}
        </View>
        <SectionTitle>Limite diário</SectionTitle>
        <View style={styles.chips}>
          {LIMITS.map((value) => (
            <Chip key={value} label={value === 0 ? 'Bloquear' : `${value} min`} selected={limit === value} onPress={() => setLimit(value)} />
          ))}
        </View>
        <SectionTitle>Identificador no Android (opcional)</SectionTitle>
        <TextInput value={customPackage} onChangeText={setCustomPackage} autoCapitalize="none" autoCorrect={false} maxLength={200}
          placeholder="ex.: com.empresa.jogo" placeholderTextColor={colors.mutedForeground}
          style={[styles.search, { borderColor: packageValid ? colors.border : colors.destructive, backgroundColor: colors.card, color: colors.foreground }]} />
        <Text style={[styles.cat, { color: colors.mutedForeground, marginTop: 8, lineHeight: 18 }]}>
          Está no endereço do app no Google Play, depois de "id=". Se o app já estiver instalado no Android da criança, é mais fácil escolhê-lo na categoria "Instalados" do catálogo.
        </Text>
        <View style={{ height: 16 }} />
        <Notice icon="info">No iPhone/iPad, o app é associado na Área do responsável do aparelho (a Apple exige a escolha no próprio aparelho). No Android, é preciso o identificador ou escolher entre os apps instalados.</Notice>
        <View style={{ height: 16 }} />
        <Button label="Salvar regra" onPress={save} loading={createRule.isPending} disabled={!customName.trim() || !packageValid} testID="custom-app-save" />
        <Button label="Voltar ao catálogo" variant="ghost" onPress={() => setCustom(false)} style={{ marginTop: 8 }} />
      </Screen>
    );
  }

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
      <Button label="Não encontrou o app? Adicionar outro" variant="secondary" icon="plus" testID="add-custom-app"
        onPress={() => { setCustom(true); setCustomName(search.trim()); setLimit(60); }} style={{ marginTop: 14 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontFamily: 'NunitoSans_500Medium', fontSize: 15 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  name: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  cat: { fontFamily: 'NunitoSans_500Medium', fontSize: 12 },
});
