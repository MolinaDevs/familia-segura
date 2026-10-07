import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon, type IconName } from '@/components/Icon';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  applyAndroidPolicies,
  getAndroidProtectionSummary,
  getAndroidSetupInfo,
  openAndroidAccessibilitySettings,
  openAndroidAppDetails,
  openAndroidAutostartSettings,
  openAndroidBatterySettings,
  openAndroidPopupPermissionSettings,
  openAndroidUsageSettings,
  openAndroidNetworkSettings,
  androidWebFilterActive,
  RECOMMENDED_FAMILY_DNS,
  requestAndroidDeviceAdmin,
  testAndroidBlock,
  type AndroidProtectionSummary,
  type AndroidSetupInfo,
} from '@/services/androidParentalControls';
import { loadCachedOverview, runChildSync } from '@/services/childSync';
import { goBack } from '@/lib/navigation';

const DISCLOSURE_KEY = '@familia-segura/android-accessibility-disclosure';
const BACKGROUND_KEY = '@familia-segura/android-background-confirmed';
const TEST_KEY = '@familia-segura/android-block-test-passed';

type StepId = 'usage' | 'accessibility' | 'admin' | 'background' | 'test';
type Maker = 'xiaomi' | 'samsung' | 'motorola' | 'other';

function makerOf(info: AndroidSetupInfo | null): Maker {
  const name = `${info?.manufacturer ?? ''} ${info?.brand ?? ''}`;
  if (/xiaomi|redmi|poco/.test(name)) return 'xiaomi';
  if (/samsung/.test(name)) return 'samsung';
  if (/motorola|lenovo/.test(name)) return 'motorola';
  return 'other';
}

/** O nome da seção onde o serviço aparece muda de fabricante para fabricante. */
const ACCESSIBILITY_SECTION: Record<Maker, string> = {
  xiaomi: 'Apps baixados',
  samsung: 'Apps instalados',
  motorola: 'Apps transferidos por download',
  other: 'Apps instalados (ou "Apps baixados")',
};

const STEP_META: Record<StepId, { icon: IconName; title: string; why: string }> = {
  usage: { icon: 'bar-chart-2', title: 'Tempo de uso', why: 'Para contar os minutos de cada app e aplicar os limites do dia.' },
  accessibility: { icon: 'shield', title: 'Serviço de proteção', why: 'É o que pausa os apps: vê qual app está aberto e mostra a tela de pausa na hora certa.' },
  admin: { icon: 'lock', title: 'Proteção contra desinstalação', why: 'Impede apagar o Família Segura sem o PIN e permite travar a tela na hora de dormir.' },
  background: { icon: 'battery-charging', title: 'Manter a proteção ligada', why: 'Alguns aparelhos desligam apps em segundo plano para economizar bateria. Isto impede que a proteção caia.' },
  test: { icon: 'play', title: 'Testar o bloqueio', why: 'Vamos conferir, neste aparelho, que a tela de pausa aparece de verdade.' },
};

function Numbered({ items }: { items: React.ReactNode[] }) {
  const colors = useColors();
  return (
    <View style={styles.numbered}>
      {items.map((item, index) => (
        <View key={index} style={styles.numberedRow}>
          <View style={[styles.bullet, { backgroundColor: colors.blueSoft }]}>
            <Text style={[styles.bulletText, { color: colors.navy }]}>{index + 1}</Text>
          </View>
          <Text style={[styles.numberedText, { color: colors.foreground }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

/**
 * Pré-visualização só em desenvolvimento na web (?demo=N, N = passos concluídos; &maker=xiaomi|samsung):
 * a tela real depende do módulo nativo, então é assim que o layout é conferido no navegador.
 */
function demoState(steps: number, maker: string): { summary: AndroidProtectionSummary; info: AndroidSetupInfo } {
  return {
    summary: {
      state: steps >= 2 ? 'partial' : 'disabled', issues: [], nativeBuildRequired: false,
      status: {
        androidApiLevel: 34, usageAccessGranted: steps >= 1, accessibilityEnabled: steps >= 2, deviceAdminActive: steps >= 3,
        batteryOptimizationExempt: steps >= 4, serviceRunning: steps >= 2, policyLeaseActive: true, guardianUnlockedUntil: Date.now() + 600_000,
        model: 'Demo', osVersion: '14', batteryLevel: 80, privateDnsMode: 'off', privateDnsHost: '',
      },
    },
    info: {
      manufacturer: maker, brand: maker, androidApiLevel: 34, installer: '', fromStore: false, policyPresent: true,
      rulesCount: 4, routinesCount: 2, tamperProtection: true, lastBlockShownAt: 0,
    },
  };
}

export default function AndroidControlsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ demo?: string; maker?: string }>();
  const demo = __DEV__ && Platform.OS === 'web' && params.demo !== undefined
    ? demoState(Number(params.demo) || 0, params.maker ?? 'xiaomi')
    : null;
  const [summary, setSummary] = useState<AndroidProtectionSummary>(() => demo?.summary ?? getAndroidProtectionSummary());
  const [info, setInfo] = useState<AndroidSetupInfo | null>(() => demo?.info ?? getAndroidSetupInfo());
  const [busy, setBusy] = useState(true);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [backgroundConfirmed, setBackgroundConfirmed] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [testFailed, setTestFailed] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [showRestrictedHelp, setShowRestrictedHelp] = useState(false);
  const [webFilter, setWebFilter] = useState<'off' | 'adult'>('off');
  const [rulesSaved, setRulesSaved] = useState<{ rules: number; routines: number; skipped: number } | null>(null);
  const testStartedAt = useRef(0);
  const previousDone = useRef(0);

  const status = summary.status;
  const maker = makerOf(info);
  const sideloaded = Boolean(info && !info.fromStore && info.androidApiLevel >= 33);

  const refresh = useCallback(async () => {
    if (demo) { setBusy(false); return; }
    setBusy(true);
    const cachedFilter = (await loadCachedOverview())?.policy.webFilter ?? 'off';
    setWebFilter(cachedFilter);
    setSummary(getAndroidProtectionSummary(cachedFilter));
    const nextInfo = getAndroidSetupInfo();
    setInfo(nextInfo);
    // Voltando do teste: a tela de pausa apareceu depois de "Testar agora"?
    if (testStartedAt.current > 0 && nextInfo) {
      const shown = nextInfo.lastBlockShownAt >= testStartedAt.current;
      testStartedAt.current = 0;
      if (shown) {
        setTestPassed(true);
        setTestFailed(false);
        setTestNotice(null);
        await AsyncStorage.setItem(TEST_KEY, 'passed');
      } else {
        setTestFailed(true);
      }
    }
    if (Platform.OS === 'android') {
      // A sincronização aplica as regras (só com resposta autenticada) e envia o estado da proteção.
      const result = await runChildSync();
      if (result.status === 'ok' && result.overview) {
        const saved = applyAndroidPolicies(result.overview.apps, result.overview.routines, result.overview.policy);
        setRulesSaved({ rules: saved.configuredRules, routines: saved.configuredRoutines, skipped: saved.skippedRules });
        setWebFilter(result.overview.policy.webFilter);
      }
      setSummary(getAndroidProtectionSummary(result.overview?.policy.webFilter ?? cachedFilter));
      setInfo(getAndroidSetupInfo());
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    void AsyncStorage.multiGet([DISCLOSURE_KEY, BACKGROUND_KEY, TEST_KEY]).then((entries) => {
      const stored = Object.fromEntries(entries);
      setDisclosureAccepted(stored[DISCLOSURE_KEY] === 'accepted');
      setBackgroundConfirmed(stored[BACKGROUND_KEY] === 'yes');
      setTestPassed(stored[TEST_KEY] === 'passed');
    });
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const done: Record<StepId, boolean> = useMemo(() => ({
    usage: Boolean(status?.usageAccessGranted),
    accessibility: Boolean(status?.accessibilityEnabled),
    admin: Boolean(status?.deviceAdminActive),
    // A isenção de bateria é detectável; o "início automático" do fabricante não — vale a confirmação da pessoa.
    background: Boolean(status?.batteryOptimizationExempt) && (maker === 'other' || maker === 'motorola' || backgroundConfirmed),
    test: testPassed && Boolean(status?.accessibilityEnabled),
  }), [status, maker, backgroundConfirmed, testPassed]);

  const order: StepId[] = ['usage', 'accessibility', 'admin', 'background', 'test'];
  const doneCount = order.filter((id) => done[id]).length;
  const current = order.find((id) => !done[id]) ?? null;

  // Passo concluído ao voltar das Configurações: vibração curta de confirmação.
  useEffect(() => {
    if (doneCount > previousDone.current && previousDone.current > 0) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    previousDone.current = doneCount;
  }, [doneCount]);

  const toggleDisclosure = async () => {
    const next = !disclosureAccepted;
    setDisclosureAccepted(next);
    if (next) await AsyncStorage.setItem(DISCLOSURE_KEY, 'accepted');
    else await AsyncStorage.removeItem(DISCLOSURE_KEY);
  };

  const confirmBackground = async () => {
    setBackgroundConfirmed(true);
    await AsyncStorage.setItem(BACKGROUND_KEY, 'yes');
  };

  const runTest = () => {
    setTestFailed(false);
    testStartedAt.current = Date.now();
    if (!testAndroidBlock()) {
      testStartedAt.current = 0;
      setTestNotice('O serviço de proteção não está respondendo. Desligue e ligue de novo a chave "Proteção Família Segura" em Acessibilidade e tente outra vez.');
      return;
    }
    setTestNotice('Indo para a tela inicial… a tela de pausa deve aparecer em 2 segundos. Depois, volte ao Família Segura.');
  };

  // Com PIN definido e o serviço já ligado, as telas de Configurações que mexem na proteção ficam bloqueadas
  // até o responsável liberar com o PIN — sem isto o próprio assistente seria barrado no meio.
  const needsPin = Boolean(info?.tamperProtection && status?.accessibilityEnabled && (status?.guardianUnlockedUntil ?? 0) < Date.now() && current && current !== 'test');

  const primary = (label: string, onPress: () => void, options: { disabled?: boolean; testID?: string } = {}) => (
    <Pressable
      testID={options.testID}
      accessibilityRole="button"
      disabled={options.disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, { backgroundColor: options.disabled ? colors.muted : colors.primary }, pressed && styles.pressed]}
    >
      <Text style={[styles.primaryButtonText, { color: options.disabled ? colors.mutedForeground : colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );

  const secondary = (label: string, onPress: () => void, testID?: string) => (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
      <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );

  const help = (text: React.ReactNode) => (
    <View style={[styles.help, { backgroundColor: colors.muted }]}>
      <Icon name="info" size={16} color={colors.mutedForeground} />
      <Text style={[styles.helpText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );

  const stepBody = (id: StepId) => {
    switch (id) {
      case 'usage':
        return (
          <>
            <Numbered items={[
              <>Toque no botão abaixo. Vai abrir uma tela do Android.</>,
              <>Se aparecer uma lista de apps, toque em <B>Família Segura</B>.</>,
              <>Ligue a chave <B>Permitir acesso ao uso</B>.</>,
              <>Volte para cá (seta de voltar). Este passo fica marcado sozinho.</>,
            ]} />
            {primary('Abrir "Acesso ao uso"', () => openAndroidUsageSettings(), { testID: 'android-usage-settings' })}
          </>
        );
      case 'accessibility':
        return (
          <>
            <Pressable testID="android-disclosure-consent" accessibilityRole="checkbox" accessibilityState={{ checked: disclosureAccepted }} onPress={toggleDisclosure}
              style={[styles.disclosureRow, { borderColor: disclosureAccepted ? colors.primary : colors.input, backgroundColor: disclosureAccepted ? colors.secondary : colors.background }]}>
              <View style={[styles.checkbox, { borderColor: disclosureAccepted ? colors.primary : colors.mutedForeground, backgroundColor: disclosureAccepted ? colors.primary : 'transparent' }]}>
                {disclosureAccepted && <Icon name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={[styles.disclosureText, { color: colors.foreground }]}>
                Entendi que o Família Segura usa o serviço de acessibilidade para identificar o aplicativo em primeiro plano e aplicar limites, pausas e bloqueios, e para impedir que a criança abra as telas de Configurações que desligariam a proteção. Ele não lê mensagens, senhas nem o que é digitado, e nada disso sai do aparelho.
              </Text>
            </Pressable>
            <Numbered items={[
              <>Marque a caixa acima e toque no botão abaixo.</>,
              <>Na tela de Acessibilidade, toque em <B>{ACCESSIBILITY_SECTION[maker]}</B>.</>,
              <>Toque em <B>Proteção Família Segura</B>.</>,
              <>Ligue a chave e confirme em <B>Permitir</B>{maker === 'xiaomi' ? <> (no Xiaomi, espere a contagem de 10 segundos e toque em <B>OK</B>)</> : null}.</>,
              <>Volte para cá.</>,
            ]} />
            {primary('Abrir Acessibilidade', () => openAndroidAccessibilitySettings(), { disabled: !disclosureAccepted, testID: 'android-accessibility-settings' })}

            {sideloaded || showRestrictedHelp ? (
              <View style={[styles.restricted, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.restrictedTitle, { color: colors.foreground }]}>A chave está cinza ou apareceu "Configuração restrita"?</Text>
                <Text style={[styles.stepWhy, { color: colors.mutedForeground }]}>
                  Acontece quando o app foi instalado fora da loja. É uma liberação única:
                </Text>
                <Numbered items={[
                  <>Tente ligar a chave uma vez (o aviso precisa aparecer primeiro) e toque em <B>OK</B>.</>,
                  <>Toque no botão abaixo para abrir as informações do app.</>,
                  <>Toque nos <B>três pontinhos</B> no canto de cima e em <B>Permitir configurações restritas</B>.</>,
                  <>Confirme com a senha ou a digital do aparelho e volte ao passo anterior.</>,
                ]} />
                {secondary('Abrir informações do app', () => openAndroidAppDetails(), 'android-app-details')}
              </View>
            ) : (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowRestrictedHelp(true)} style={styles.linkRow}>
                <Text style={[styles.link, { color: colors.primary }]}>A chave está cinza ou não consigo ligar</Text>
              </Pressable>
            )}
          </>
        );
      case 'admin':
        return (
          <>
            <Numbered items={[
              <>Toque no botão abaixo. O Android mostra uma tela explicando o que será permitido.</>,
              <>Role até o fim e toque em <B>Ativar este app de administrador do dispositivo</B>.</>,
            ]} />
            {primary('Ativar proteção contra desinstalação', () => requestAndroidDeviceAdmin(), { testID: 'android-device-admin' })}
          </>
        );
      case 'background':
        return (
          <>
            {!status?.batteryOptimizationExempt ? (
              <>
                <Numbered items={[
                  <>Toque no botão abaixo.</>,
                  <>No alto da lista, troque <B>Não otimizados</B> por <B>Todos os apps</B>.</>,
                  <>Toque em <B>Família Segura</B> e escolha <B>Não otimizar</B>{maker === 'xiaomi' || maker === 'samsung' ? <> (ou <B>Sem restrições</B>)</> : null}.</>,
                  <>Volte para cá.</>,
                ]} />
                {primary('Abrir configurações de bateria', () => openAndroidBatterySettings(), { testID: 'android-battery-settings' })}
              </>
            ) : (
              <>
                <Numbered items={[
                  <>Toque no botão abaixo para abrir o <B>Início automático</B>{maker === 'samsung' ? <> (em Samsung: <B>Bateria → Limites de uso em segundo plano</B>)</> : null}.</>,
                  maker === 'samsung'
                    ? <>Em <B>Apps nunca suspensos</B>, adicione o <B>Família Segura</B>.</>
                    : <>Procure <B>Família Segura</B> na lista e ligue a chave.</>,
                  <>Volte para cá e toque em <B>Já fiz</B>.</>,
                ]} />
                {primary('Abrir início automático', () => { if (!openAndroidAutostartSettings()) openAndroidAppDetails(); }, { testID: 'android-autostart' })}
                {secondary('Já fiz', () => void confirmBackground(), 'android-background-done')}
              </>
            )}
          </>
        );
      case 'test':
        return (
          <>
            <Numbered items={[
              <>Toque em <B>Testar agora</B>. O aparelho vai para a tela inicial.</>,
              <>Em 2 segundos deve aparecer a tela <B>Pausa combinada</B>.</>,
              <>Toque em <B>Pedir mais tempo</B> nela para voltar aqui.</>,
            ]} />
            {primary('Testar agora', runTest, { testID: 'android-test-block' })}
            {testNotice ? help(testNotice) : null}
            {testFailed ? (
              <View style={[styles.restricted, { borderColor: colors.destructive, backgroundColor: colors.background }]}>
                <Text style={[styles.restrictedTitle, { color: colors.foreground }]}>A tela de pausa não apareceu</Text>
                {maker === 'xiaomi' ? (
                  <>
                    <Text style={[styles.stepWhy, { color: colors.mutedForeground }]}>
                      Em Xiaomi, Redmi e POCO falta uma permissão que só existe nesses aparelhos:
                    </Text>
                    <Numbered items={[
                      <>Toque no botão abaixo (<B>Outras permissões</B>).</>,
                      <>Ligue <B>Exibir janelas pop-up enquanto executa em segundo plano</B>.</>,
                      <>Volte para cá e toque em <B>Testar agora</B> de novo.</>,
                    ]} />
                    {secondary('Abrir outras permissões', () => { if (!openAndroidPopupPermissionSettings()) openAndroidAppDetails(); }, 'android-popup-permission')}
                  </>
                ) : (
                  <Text style={[styles.stepWhy, { color: colors.mutedForeground }]}>
                    Confira se a chave "Proteção Família Segura" continua ligada em Acessibilidade e se a bateria está em "Não otimizar". Se continuar, reinicie o aparelho e teste de novo.
                  </Text>
                )}
              </View>
            ) : null}
          </>
        );
    }
  };

  if (!demo && (summary.nativeBuildRequired || Platform.OS !== 'android')) {
    return (
      <View style={[styles.unavailable, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
        <Icon name="alert-circle" size={28} color={colors.mutedForeground} />
        <Text style={[styles.title, { color: colors.foreground, textAlign: 'center' }]}>Disponível só no app Android instalado</Text>
        <Text style={[styles.stepWhy, { color: colors.mutedForeground, textAlign: 'center' }]}>O controle não funciona no Expo Go nem na versão web.</Text>
      </View>
    );
  }

  const allDone = current === null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.nav}>
        <Pressable testID="android-controls-back" accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => goBack('/(child)/guardian')} hitSlop={10}>
          <Icon name="arrow-left" size={23} color={colors.foreground} />
        </Pressable>
        {busy ? <ActivityIndicator color={colors.primary} /> : <View style={{ width: 23 }} />}
      </View>

      <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
        {allDone ? 'Aparelho protegido' : 'Proteger este aparelho'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {allDone
          ? 'Tudo certo. Os combinados da família já valem aqui, mesmo sem internet.'
          : 'São 5 passos, feitos pelo responsável, uma vez só. Cada um abre uma tela do Android; ao voltar, o passo fica marcado sozinho.'}
      </Text>

      <View style={styles.progressRow} accessibilityLabel={`${doneCount} de ${order.length} passos concluídos`}>
        {order.map((id) => (
          <View key={id} style={[styles.progressBar, { backgroundColor: done[id] ? colors.success : id === current ? colors.primary : colors.border }]} />
        ))}
      </View>
      <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{doneCount} de {order.length} concluídos</Text>

      {needsPin ? (
        <View style={[styles.restricted, { borderColor: colors.accent, backgroundColor: colors.card }]}>
          <Text style={[styles.restrictedTitle, { color: colors.foreground }]}>Libere com o PIN para continuar</Text>
          <Text style={[styles.stepWhy, { color: colors.mutedForeground }]}>
            A proteção já está ligada e bloqueia as telas de Configurações. Digite o PIN do responsável para liberar por 15 minutos e terminar os passos.
          </Text>
          {secondary('Digitar o PIN', () => router.replace('/(child)/guardian'), 'android-needs-pin')}
        </View>
      ) : null}

      {order.map((id, index) => {
        const meta = STEP_META[id];
        const isCurrent = id === current;
        const isDone = done[id];
        return (
          <View key={id} testID={`android-step-${id}`} style={[styles.step, { backgroundColor: colors.card, borderColor: isCurrent ? colors.primary : colors.border }, !isCurrent && !isDone && styles.stepPending]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepIcon, { backgroundColor: isDone ? colors.success : isCurrent ? colors.blueSoft : colors.muted }]}>
                <Icon name={isDone ? 'check' : meta.icon} size={18} color={isDone ? colors.background : colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepEyebrow, { color: isDone ? colors.success : colors.mutedForeground }]}>
                  {isDone ? 'Concluído' : `Passo ${index + 1}`}
                </Text>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>{meta.title}</Text>
              </View>
            </View>
            {isCurrent ? (
              <>
                <Text style={[styles.stepWhy, { color: colors.mutedForeground }]}>{meta.why}</Text>
                {stepBody(id)}
              </>
            ) : null}
          </View>
        );
      })}

      {allDone ? (
        <View style={[styles.doneCard, { backgroundColor: colors.secondary }]}>
          <Icon name="shield" size={22} color={colors.secondaryForeground} />
          <Text style={[styles.doneText, { color: colors.secondaryForeground }]}>
            {rulesSaved
              ? `${rulesSaved.rules} regra(s) de app e ${rulesSaved.routines} rotina(s) estão valendo neste aparelho.${rulesSaved.skipped > 0 ? ` ${rulesSaved.skipped} regra(s) ainda não têm um app Android associado: ajuste no app do responsável.` : ''}`
              : 'As regras da família chegam a este aparelho em instantes.'}
            {' '}Para mudar regras, use o app do responsável.
          </Text>
        </View>
      ) : null}
      {allDone ? primary('Concluir', () => router.replace('/(child)'), { testID: 'android-setup-finish' }) : null}

      {(allDone || done.accessibility) && webFilter === 'adult' ? (
        <View style={[styles.step, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepIcon, { backgroundColor: androidWebFilterActive(status) ? colors.success : colors.muted }]}>
              <Icon name={androidWebFilterActive(status) ? 'check' : 'globe'} size={18} color={androidWebFilterActive(status) ? colors.background : colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepEyebrow, { color: colors.mutedForeground }]}>Extra, escolhido pela família</Text>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Filtro de conteúdo adulto</Text>
            </View>
          </View>
          {!androidWebFilterActive(status) ? (
            <>
              <Text style={[styles.stepWhy, { color: colors.mutedForeground }]}>
                Usa um DNS familiar gratuito: bloqueia sites adultos e liga a busca segura em todo o aparelho.
              </Text>
              <Numbered items={[
                <>Toque no botão abaixo e procure <B>DNS privado</B> (em Rede e internet, ou Conexões → Mais configurações).</>,
                <>Escolha <B>Nome do host do provedor de DNS privado</B> e digite o endereço abaixo.</>,
              ]} />
              <Text selectable style={[styles.dnsHost, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}>{RECOMMENDED_FAMILY_DNS}</Text>
              {secondary('Abrir configurações de rede', () => openAndroidNetworkSettings(), 'android-dns-settings')}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.note, { backgroundColor: colors.muted }]}>
        <Icon name="lock" size={16} color={colors.mutedForeground} />
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
          As regras ficam neste aparelho para funcionar sem internet. O servidor recebe o estado da proteção, os minutos de uso por app e a lista de apps instalados. Não lemos mensagens, fotos, senhas nem o que é digitado.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  unavailable: { flex: 1, alignItems: 'center', gap: 10, padding: 24 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, minHeight: 28 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 25, lineHeight: 31 },
  subtitle: { fontFamily: 'NunitoSans_500Medium', fontSize: 15, lineHeight: 22, marginTop: 8 },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  progressBar: { flex: 1, height: 6, borderRadius: 3 },
  progressText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 12.5, marginTop: 8 },
  step: { borderWidth: 1.5, borderRadius: 20, padding: 16, marginTop: 12 },
  stepPending: { opacity: 0.6 },
  stepHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stepIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepEyebrow: { fontFamily: 'NunitoSans_700Bold', fontSize: 12 },
  stepTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16.5, marginTop: 1 },
  stepWhy: { fontFamily: 'NunitoSans_500Medium', fontSize: 14, lineHeight: 20, marginTop: 12 },
  numbered: { gap: 10, marginTop: 14 },
  numberedRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bulletText: { fontFamily: 'Montserrat_700Bold', fontSize: 12 },
  numberedText: { flex: 1, fontFamily: 'NunitoSans_500Medium', fontSize: 15, lineHeight: 22 },
  bold: { fontFamily: 'NunitoSans_800ExtraBold' },
  disclosureRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  disclosureText: { flex: 1, fontFamily: 'NunitoSans_500Medium', fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 14 },
  primaryButtonText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 15.5, textAlign: 'center' },
  secondaryButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 14 },
  secondaryButtonText: { fontFamily: 'NunitoSans_700Bold', fontSize: 14.5, textAlign: 'center' },
  linkRow: { alignItems: 'center', paddingVertical: 14, minHeight: 44 },
  link: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  restricted: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 14 },
  restrictedTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 15 },
  help: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 14, padding: 12, marginTop: 12 },
  helpText: { flex: 1, fontFamily: 'NunitoSans_600SemiBold', fontSize: 13.5, lineHeight: 19 },
  doneCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 18, padding: 15, marginTop: 14 },
  doneText: { flex: 1, fontFamily: 'NunitoSans_600SemiBold', fontSize: 14, lineHeight: 20 },
  dnsHost: { fontFamily: 'NunitoSans_700Bold', fontSize: 14, textAlign: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 14, marginTop: 20 },
  noteText: { flex: 1, fontFamily: 'NunitoSans_500Medium', fontSize: 12.5, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
