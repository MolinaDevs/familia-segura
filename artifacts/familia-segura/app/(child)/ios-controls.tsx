import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetChildOverviewQueryKey, useGetChildOverview } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import {
  applyNativePolicies,
  getNativeControlState,
  loadNativeControls,
  requestNativeControlAuthorization,
  selectionIdForRule,
  type NativeControlState,
  type NativePolicyResult,
} from '@/services/iosParentalControls';

type PickerProps = {
  familyActivitySelectionId: string;
  includeEntireCategory?: boolean;
  headerText?: string;
  footerText?: string;
  onSelectionChange?: () => void;
  style?: object;
};

const stateCopy: Record<NativeControlState, { title: string; detail: string }> = {
  unsupported: { title: 'Disponível no iPhone e iPad', detail: 'Este aparelho não oferece as APIs Family Controls da Apple.' },
  'native-build-required': { title: 'Build nativa necessária', detail: 'O controle iOS não funciona no Expo Go. Instale uma build de distribuição do Família Segura.' },
  'not-determined': { title: 'Autorização pendente', detail: 'Um responsável deve concluir a autorização oficial da Apple neste aparelho.' },
  denied: { title: 'Permissão desativada', detail: 'A proteção foi revogada. Reative Family Controls para aplicar limites e pausas.' },
  approved: { title: 'Proteção autorizada', detail: 'Selecione os apps e categorias associados a cada combinado.' },
  error: { title: 'Não foi possível autorizar', detail: 'Confira os entitlements da build e tente novamente.' },
};

export default function IOSControlsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useGetChildOverview({ query: { queryKey: getGetChildOverviewQueryKey(), retry: false } });
  const [state, setState] = useState<NativeControlState>('not-determined');
  const [busy, setBusy] = useState(true);
  const [result, setResult] = useState<NativePolicyResult | null>(null);
  const [Picker, setPicker] = useState<React.ComponentType<PickerProps> | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    const nextState = await getNativeControlState();
    setState(nextState);
    if (nextState === 'approved') {
      const native = await loadNativeControls();
      setPicker(() => native?.DeviceActivitySelectionViewPersisted as React.ComponentType<PickerProps> | undefined ?? null);
      if (data) setResult(await applyNativePolicies(data.apps, data.routines));
    }
    setBusy(false);
  }, [data]);

  useEffect(() => { void refresh(); }, [refresh]);

  const authorize = async () => {
    setBusy(true);
    setState(await requestNativeControlAuthorization());
    setBusy(false);
    await refresh();
  };

  const copy = stateCopy[state];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 32 }]}>
      <View style={styles.nav}>
        <Pressable testID="ios-controls-back" onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={23} color={colors.foreground} /></Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Controle no iPhone</Text>
        <View style={{ width: 23 }} />
      </View>

      <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.statusIcon, { backgroundColor: state === 'approved' ? colors.secondary : colors.muted }]}>
          <Feather name={state === 'approved' ? 'shield' : 'alert-circle'} size={24} color={state === 'approved' ? colors.secondaryForeground : colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>{copy.title}</Text>
          <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>{copy.detail}</Text>
        </View>
      </View>

      {busy && <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />}

      {!busy && (state === 'not-determined' || state === 'denied' || state === 'error') && (
        <Pressable testID="ios-controls-authorize" onPress={authorize} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>Autorizar com a Apple</Text>
        </Pressable>
      )}

      {state === 'approved' && data && (
        <>
          {result && (
            <Text style={[styles.summary, { color: colors.mutedForeground }]}>
              {result.configuredRules} regras e {result.configuredRoutines} rotinas ativas. {result.skippedRules > 0 ? `${result.skippedRules} regras ainda precisam de uma seleção.` : ''}
            </Text>
          )}
          {data.apps.map((app) => (
            <View key={app.id} style={[styles.ruleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.ruleTitle, { color: colors.foreground }]}>{app.appName}</Text>
              <Text style={[styles.ruleDetail, { color: colors.mutedForeground }]}>
                {app.status === 'blocked' ? 'Bloqueado' : `${app.dailyLimitMinutes} min por dia`} · a Apple mantém os nomes escolhidos privados.
              </Text>
              {Picker ? (
                <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Picker
                    familyActivitySelectionId={selectionIdForRule(app.id)}
                    includeEntireCategory
                    headerText={`Escolha o app ou categoria para ${app.appName}`}
                    footerText="A seleção fica armazenada somente neste aparelho."
                    onSelectionChange={() => { void refresh(); }}
                    style={styles.picker}
                  />
                </View>
              ) : (
                <Text style={[styles.ruleDetail, { color: colors.mutedForeground }]}>Seletor nativo indisponível nesta build.</Text>
              )}
            </View>
          ))}
        </>
      )}

      <View style={[styles.note, { backgroundColor: colors.secondary }]}>
        <Feather name="lock" size={18} color={colors.secondaryForeground} />
        <Text style={[styles.noteText, { color: colors.secondaryForeground }]}>O Família Segura recebe somente eventos e totais permitidos pela Apple. A lista de apps instalada não é enviada ao servidor.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  navTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  statusCard: { flexDirection: 'row', gap: 13, alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 16 },
  statusIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  statusDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  primaryButton: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryButtonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  summary: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, marginVertical: 18 },
  ruleCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 12 },
  ruleTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  ruleDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  pickerWrap: { height: 310, borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginTop: 14 },
  picker: { width: '100%', flex: 1 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 18, padding: 15, marginTop: 22 },
  noteText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});