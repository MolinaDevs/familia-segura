import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetChildOverviewQueryKey, useGetChildOverview, useSyncChildProtection } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import {
  applyAndroidPolicies,
  getAndroidProtectionSummary,
  openAndroidAccessibilitySettings,
  openAndroidBatterySettings,
  openAndroidUsageSettings,
  type AndroidProtectionSummary,
} from '@/services/androidParentalControls';

const DISCLOSURE_KEY = '@familia-segura/android-accessibility-disclosure';

const stateCopy = {
  active: { title: 'Proteção ativa', detail: 'Uso, limites e pausas estão sendo aplicados neste aparelho.' },
  partial: { title: 'Proteção parcial', detail: 'Uma configuração do sistema ainda limita a proteção.' },
  disabled: { title: 'Proteção desativada', detail: 'Conclua as duas permissões essenciais para aplicar os combinados.' },
  unavailable: { title: 'Build nativa necessária', detail: 'O controle Android não funciona no Expo Go ou na web.' },
};

export default function AndroidControlsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isSuccess, isFetchedAfterMount, dataUpdatedAt } = useGetChildOverview({ query: { queryKey: getGetChildOverviewQueryKey(), retry: false } });
  const { mutate: syncProtectionState } = useSyncChildProtection();
  const [summary, setSummary] = useState<AndroidProtectionSummary>(() => getAndroidProtectionSummary());
  const [busy, setBusy] = useState(true);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [policyResult, setPolicyResult] = useState<{ configuredRules: number; configuredRoutines: number; skippedRules: number } | null>(null);
  const appliedPolicyAt = useRef(0);

  const refresh = useCallback(async () => {
    setBusy(true);
    const next = getAndroidProtectionSummary();
    setSummary(next);
    if (Platform.OS === 'android' && !next.nativeBuildRequired) {
      syncProtectionState({ data: { state: next.state, issues: next.issues } });
    }
    setBusy(false);
  }, [syncProtectionState]);

  useEffect(() => {
    if (
      Platform.OS !== 'android'
      || !data
      || !isSuccess
      || !isFetchedAfterMount
      || dataUpdatedAt <= appliedPolicyAt.current
    ) return;
    setPolicyResult(applyAndroidPolicies(data.apps, data.routines));
    appliedPolicyAt.current = dataUpdatedAt;
  }, [data, isSuccess, isFetchedAfterMount, dataUpdatedAt]);

  useEffect(() => {
    AsyncStorage.getItem(DISCLOSURE_KEY).then((value) => setDisclosureAccepted(value === 'accepted'));
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const acceptDisclosure = async () => {
    const next = !disclosureAccepted;
    setDisclosureAccepted(next);
    if (next) await AsyncStorage.setItem(DISCLOSURE_KEY, 'accepted');
    else await AsyncStorage.removeItem(DISCLOSURE_KEY);
  };

  const openAccessibility = async () => {
    if (!disclosureAccepted) return;
    await AsyncStorage.setItem(DISCLOSURE_KEY, 'accepted');
    openAndroidAccessibilitySettings();
  };

  const copy = stateCopy[summary.state];
  const status = summary.status;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12,
        paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 32,
      }]}
    >
      <View style={styles.nav}>
        <Pressable testID="android-controls-back" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={23} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Controle no Android</Text>
        <View style={{ width: 23 }} />
      </View>

      <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.statusIcon, { backgroundColor: summary.state === 'active' ? colors.secondary : colors.muted }]}>
          <Feather name={summary.state === 'active' ? 'shield' : 'alert-circle'} size={24} color={summary.state === 'active' ? colors.secondaryForeground : colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>{copy.title}</Text>
          <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>{copy.detail}</Text>
          {summary.issues.map((issue) => <Text key={issue} style={[styles.issue, { color: colors.mutedForeground }]}>• {issue}</Text>)}
        </View>
      </View>

      {busy && <ActivityIndicator color={colors.primary} style={styles.loader} />}

      {!summary.nativeBuildRequired && Platform.OS === 'android' && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Configuração necessária</Text>

          <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumber, { backgroundColor: status?.usageAccessGranted ? colors.secondary : colors.muted }]}>
                <Feather name={status?.usageAccessGranted ? 'check' : 'bar-chart-2'} size={18} color={status?.usageAccessGranted ? colors.secondaryForeground : colors.foreground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>1. Acesso ao uso</Text>
                <Text style={[styles.stepDetail, { color: colors.mutedForeground }]}>Permite calcular somente o tempo dos apps que possuem um combinado.</Text>
              </View>
            </View>
            <Pressable testID="android-usage-settings" onPress={openAndroidUsageSettings} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>{status?.usageAccessGranted ? 'Revisar configuração' : 'Abrir acesso ao uso'}</Text>
            </Pressable>
          </View>

          <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumber, { backgroundColor: status?.accessibilityEnabled ? colors.secondary : colors.muted }]}>
                <Feather name={status?.accessibilityEnabled ? 'check' : 'shield'} size={18} color={status?.accessibilityEnabled ? colors.secondaryForeground : colors.foreground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>2. Serviço de proteção</Text>
                <Text style={[styles.stepDetail, { color: colors.mutedForeground }]}>Detecta qual app está aberto para mostrar o bloqueio no momento certo.</Text>
              </View>
            </View>
            <Pressable testID="android-disclosure-consent" onPress={acceptDisclosure} style={styles.disclosureRow}>
              <View style={[styles.checkbox, { borderColor: disclosureAccepted ? colors.primary : colors.input, backgroundColor: disclosureAccepted ? colors.primary : colors.background }]}>
                {disclosureAccepted && <Feather name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={[styles.disclosureText, { color: colors.foreground }]}>
                Entendi que o Família Segura identifica o aplicativo em primeiro plano para aplicar limites e pausas. Ele não lê mensagens, senhas, textos ou conteúdo da tela.
              </Text>
            </Pressable>
            <Pressable
              testID="android-accessibility-settings"
              disabled={!disclosureAccepted}
              onPress={openAccessibility}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: disclosureAccepted ? colors.primary : colors.muted }, pressed && styles.pressed]}
            >
              <Text style={[styles.primaryButtonText, { color: disclosureAccepted ? colors.primaryForeground : colors.mutedForeground }]}>
                {status?.accessibilityEnabled ? 'Revisar serviço' : 'Ativar serviço de proteção'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumber, { backgroundColor: status?.batteryOptimizationExempt ? colors.secondary : colors.accent }]}>
                <Feather name="battery-charging" size={18} color={status?.batteryOptimizationExempt ? colors.secondaryForeground : colors.accentForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>3. Bateria</Text>
                <Text style={[styles.stepDetail, { color: colors.mutedForeground }]}>Recomendado em aparelhos que encerram serviços em segundo plano.</Text>
              </View>
            </View>
            <Pressable testID="android-battery-settings" onPress={openAndroidBatterySettings} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Abrir configurações de bateria</Text>
            </Pressable>
          </View>

          {policyResult && (
            <Text style={[styles.summary, { color: colors.mutedForeground }]}>
              {policyResult.configuredRules} regras e {policyResult.configuredRoutines} rotinas salvas no aparelho. {policyResult.skippedRules > 0 ? `${policyResult.skippedRules} regras precisam de um pacote Android compatível.` : ''}
            </Text>
          )}
        </>
      )}

      <View style={[styles.note, { backgroundColor: colors.secondary }]}>
        <Feather name="lock" size={18} color={colors.secondaryForeground} />
        <Text style={[styles.noteText, { color: colors.secondaryForeground }]}>
          As regras ficam neste aparelho para funcionar offline. O servidor recebe somente estado da proteção e totais de uso dos apps combinados.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  navTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  statusCard: { flexDirection: 'row', gap: 13, alignItems: 'flex-start', borderWidth: 1, borderRadius: 20, padding: 16 },
  statusIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  statusDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  issue: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 17, marginTop: 2 },
  loader: { marginVertical: 20 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 24, marginBottom: 2 },
  stepCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 12 },
  stepHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  stepDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 3 },
  disclosureRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  disclosureText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 12 },
  primaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center' },
  secondaryButton: { minHeight: 46, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 12 },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' },
  summary: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, marginTop: 18 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 18, padding: 15, marginTop: 22 },
  noteText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});