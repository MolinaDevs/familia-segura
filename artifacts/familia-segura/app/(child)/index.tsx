import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateTimeRequest, type AppRule, type ChildOverview } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Icon, iconName } from '@/components/Icon';
import { AppIcon } from '@/components/AppIcon';
import { Button, Card, Chip, EmptyState, Notice, SectionTitle, formatMinutes } from '@/components/ui';
import { AuthField } from '@/components/auth/AuthKit';
import { BrandBackground } from '@/components/brand/BrandBackground';
import { BrandLoading } from '@/components/brand/BrandLoading';
import { Emblem } from '@/components/brand/Logo';
import { routineMoment } from '@/lib/routineTime';
import { pauseLabel } from '@/components/PauseCard';
import { loadCachedOverview, runChildSync, type SyncStatus } from '@/services/childSync';
import { registerChildBackgroundSync } from '@/services/backgroundSync';
import { registerChildPush } from '@/services/push';

const FOREGROUND_REFRESH_MS = 60_000;
type Feedback = { tone: 'success' | 'danger'; text: string } | null;

const DAY_LABELS: Record<string, string> = { dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb' };
function formatDays(days: string) {
  const list = days.split(',').map((d) => d.trim()).filter(Boolean);
  if (list.length === 7) return 'todos os dias';
  return list.map((d) => DAY_LABELS[d] ?? d).join(', ');
}

/** Tempo da criança no app hoje (o limite é dela, somando todos os aparelhos). */
function appTime(app: AppRule) {
  const used = app.usageTodayMinutes + (app.otherDevicesUsageMinutes ?? 0);
  const limit = app.dailyLimitMinutes;
  const left = Math.max(0, limit - used);
  const blocked = app.status === 'blocked';
  return { used, limit, left, blocked, over: !blocked && left === 0, ratio: limit > 0 ? Math.min(1, used / limit) : 1 };
}

/** Um app com barra do tempo de hoje: a informação que a criança mais procura. */
function AppTimeRow({ app, last }: { app: AppRule; last?: boolean }) {
  const colors = useColors();
  const t = appTime(app);
  const tint = t.blocked || t.over ? colors.destructive : t.ratio >= 0.8 ? colors.warning : colors.primary;
  const label = t.blocked ? 'Fora dos combinados da família'
    : t.over ? 'O tempo de hoje acabou'
    : `Restam ${formatMinutes(t.left)} de ${formatMinutes(t.limit)}`;
  return (
    <View style={[styles.appRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <AppIcon name={app.icon} color={app.iconColor || colors.primary} size={42} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.appHead}>
          <Text numberOfLines={1} style={[styles.appName, { color: colors.foreground }]}>{app.appName}</Text>
          {app.extraTodayMinutes > 0 && !t.blocked ? (
            <Text style={[styles.extra, { color: colors.success }]}>+{app.extraTodayMinutes} min hoje</Text>
          ) : null}
        </View>
        {t.blocked ? null : (
          <View style={[styles.track, { backgroundColor: colors.muted }]}
            accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: t.limit, now: Math.min(t.used, t.limit) }}>
            <View style={[styles.fill, { backgroundColor: tint, width: `${Math.round(t.ratio * 100)}%` }]} />
          </View>
        )}
        <Text style={[styles.appDetail, { color: t.blocked || t.over ? colors.destructive : colors.mutedForeground }]}>{label}</Text>
      </View>
    </View>
  );
}

export default function ChildDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const createRequest = useCreateTimeRequest();

  const [overview, setOverview] = useState<ChildOverview | null>(null);
  const [status, setStatus] = useState<SyncStatus | 'loading'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [message, setMessage] = useState('');
  const [installName, setInstallName] = useState('');
  const [installSending, setInstallSending] = useState(false);
  const [timeFeedback, setTimeFeedback] = useState<Feedback>(null);
  const [installFeedback, setInstallFeedback] = useState<Feedback>(null);

  const sync = useCallback(async () => {
    const result = await runChildSync();
    if (result.status === 'revoked' || result.status === 'unpaired') {
      router.replace('/(child)/pair');
      return;
    }
    if (result.overview) setOverview(result.overview);
    setStatus(result.status);
  }, [router]);

  useEffect(() => {
    let active = true;
    loadCachedOverview().then((cached) => { if (active && cached) setOverview((current) => current ?? cached); });
    void sync();
    void registerChildBackgroundSync();
    void registerChildPush();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void sync(); });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void sync(); }, FOREGROUND_REFRESH_MS);
    return () => {
      active = false;
      subscription.remove();
      clearInterval(interval);
    };
  }, [sync]);

  const onRefresh = async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  };

  const isOffline = status === 'offline';
  const failure = (err: unknown): Feedback => ({
    tone: 'danger',
    text: (err as { status?: number }).status === 409
      ? 'Você já tem um pedido esperando resposta. Assim que sua família responder, dá para pedir de novo.'
      : 'O pedido não saiu. Confira a internet e tente de novo.',
  });

  const handleRequestTime = async () => {
    if (!overview || !appId || !minutes || isOffline) return;
    setLoading(true);
    setTimeFeedback(null);
    try {
      await createRequest.mutateAsync({
        data: { childId: overview.child.id, appId, requestedMinutes: parseInt(minutes, 10), message },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeFeedback({ tone: 'success', text: 'Pedido enviado. Sua família recebe um aviso e responde por aqui.' });
      setAppId('');
      setMinutes('');
      setMessage('');
      void sync();
    } catch (err) {
      setTimeFeedback(failure(err));
    } finally {
      setLoading(false);
    }
  };

  // Pedido para instalar um app novo (a instalação fica bloqueada; o responsável libera por alguns minutos).
  const handleRequestInstall = async () => {
    if (!overview || !installName.trim() || isOffline) return;
    setInstallSending(true);
    setInstallFeedback(null);
    try {
      await createRequest.mutateAsync({ data: { kind: 'install', childId: overview.child.id, appId: installName.trim(), requestedMinutes: 15, message: '' } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInstallFeedback({ tone: 'success', text: 'Pedido enviado. Quando sua família aprovar, a loja fica liberada por alguns minutos.' });
      setInstallName('');
      void sync();
    } catch (err) {
      setInstallFeedback(failure(err));
    } finally {
      setInstallSending(false);
    }
  };

  if (!overview && status === 'loading') return <BrandLoading detail="Carregando seus combinados..." />;

  if (!overview) {
    return (
      <BrandBackground>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <EmptyState
            icon="wifi-off"
            title="Sem conexão agora"
            detail="Não deu para carregar seus combinados. Assim que a internet voltar, tente de novo."
            action={<Button label="Tentar de novo" icon="refresh-cw" onPress={() => void sync()} style={{ alignSelf: 'stretch', marginTop: 8 }} />}
          />
        </View>
      </BrandBackground>
    );
  }

  const installUnlockedUntil = overview.policy.installUnlockUntil ? new Date(overview.policy.installUnlockUntil) : null;
  const installOpen = Boolean(installUnlockedUntil && installUnlockedUntil.getTime() > Date.now());
  const moment = routineMoment(overview.routines);
  const familyPause = overview.policy.pausedUntil && new Date(overview.policy.pausedUntil).getTime() > Date.now()
    ? overview.policy.pausedUntil : null;
  const apps = [...overview.apps].sort((a, b) => Number(a.status === 'blocked') - Number(b.status === 'blocked'));
  const usedToday = overview.apps.filter((a) => a.status !== 'blocked')
    .reduce((sum, a) => sum + a.usageTodayMinutes + (a.otherDevicesUsageMinutes ?? 0), 0);

  return (
    <BrandBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Emblem size={44} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[styles.greeting, { color: colors.foreground }]}>Oi, {overview.child.displayName}!</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {usedToday > 0 ? `Hoje você já usou ${formatMinutes(usedToday)} nos apps combinados.` : 'Seu tempo de hoje e o que está combinado com a família.'}
            </Text>
          </View>
        </View>

        {isOffline ? (
          <View style={{ marginBottom: 12 }}>
            <Notice icon="wifi-off" tone="warning">Sem internet: dá para consultar, e os pedidos voltam a funcionar quando a conexão voltar.</Notice>
          </View>
        ) : null}

        {familyPause ? (
          <Card style={[styles.now, { backgroundColor: colors.secondary, borderColor: colors.secondary }]}>
            <View style={[styles.nowIcon, { backgroundColor: colors.card }]}>
              <Icon name="pause" size={24} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nowTitle, { color: colors.foreground }]}>Sua família pausou os apps</Text>
              <Text style={[styles.nowDetail, { color: colors.mutedForeground }]}>
                Pausa {pauseLabel(familyPause, 'child')}. Ligações, emergência e o despertador continuam funcionando.
              </Text>
            </View>
          </Card>
        ) : moment ? (
          <Card style={[styles.now, moment.state === 'active' && { backgroundColor: colors.secondary, borderColor: colors.secondary }]}>
            <View style={[styles.nowIcon, { backgroundColor: moment.state === 'active' ? colors.card : colors.blueSoft }]}>
              <Icon name={iconName(moment.routine.icon, 'moon')} size={24} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nowTitle, { color: colors.foreground }]}>
                {moment.state === 'active' ? `Agora: ${moment.routine.title}` : `Próxima pausa: ${moment.routine.title}`}
              </Text>
              <Text style={[styles.nowDetail, { color: colors.mutedForeground }]}>
                {moment.state === 'active'
                  ? `Os apps voltam às ${moment.until}. Ligações, emergência e o despertador continuam funcionando.`
                  : `Começa ${moment.startsIn}.`}
              </Text>
            </View>
          </Card>
        ) : null}

        {apps.length > 0 ? (
          <>
            <SectionTitle>Seu tempo hoje</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {apps.map((app, i) => <AppTimeRow key={app.id} app={app} last={i === apps.length - 1} />)}
            </Card>
          </>
        ) : null}

        {overview.policy.pendingPackages.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Notice icon="clock" tone="warning">
              {overview.policy.pendingPackages.length === 1
                ? '1 app instalado agora está esperando o OK da sua família.'
                : `${overview.policy.pendingPackages.length} apps instalados agora estão esperando o OK da sua família.`}
            </Notice>
          </View>
        ) : null}

        {overview.pendingRequests.length > 0 ? (
          <>
            <SectionTitle>Esperando resposta</SectionTitle>
            <Card style={{ gap: 10 }}>
              {overview.pendingRequests.map((request) => (
                <View key={request.id} style={styles.pending}>
                  <Icon name="clock" size={18} color={colors.warning} />
                  <Text style={[styles.pendingText, { color: colors.foreground }]}>
                    {request.kind === 'install' ? `Instalar ${request.appName}` : `+${request.requestedMinutes} min de ${request.appName}`}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {overview.apps.some((a) => a.status !== 'blocked') ? (
          <>
            <SectionTitle>Pedir mais tempo</SectionTitle>
            <Card style={{ gap: 16 }}>
              <View style={styles.group}>
                <Text style={[styles.label, { color: colors.foreground }]}>Para qual app?</Text>
                <View style={styles.chips}>
                  {overview.apps.filter((a) => a.status !== 'blocked').map((app) => (
                    <Chip key={app.id} label={app.appName} selected={appId === app.appId} onPress={() => { setAppId(app.appId); setTimeFeedback(null); }} testID={`request-app-${app.appId}`} />
                  ))}
                </View>
              </View>
              <View style={styles.group}>
                <Text style={[styles.label, { color: colors.foreground }]}>Quanto tempo?</Text>
                <View style={styles.chips}>
                  {['10', '15', '30', '45', '60'].map((value) => (
                    <Chip key={value} label={`${value} min`} selected={minutes === value} onPress={() => { setMinutes(value); setTimeFeedback(null); }} testID={`request-minutes-${value}`} />
                  ))}
                </View>
              </View>
              <AuthField
                label="Por quê? (opcional)"
                icon="message-circle"
                value={message}
                onChangeText={setMessage}
                maxLength={240}
                placeholder="Ex.: preciso terminar um trabalho da escola"
                helper="Explicar ajuda sua família a decidir."
              />
              {timeFeedback ? <Notice icon={timeFeedback.tone === 'success' ? 'check-circle' : 'alert-circle'} tone={timeFeedback.tone}>{timeFeedback.text}</Notice> : null}
              <Button label="Enviar pedido" icon="send" onPress={() => void handleRequestTime()} loading={loading}
                disabled={!appId || !minutes || isOffline} testID="request-time-submit" />
            </Card>
          </>
        ) : null}

        {overview.policy.blockAppInstalls ? (
          <>
            <SectionTitle>Quero instalar um app</SectionTitle>
            {installOpen && installUnlockedUntil ? (
              <Notice icon="download" tone="success">
                Loja liberada até {installUnlockedUntil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. O que você instalar agora já entra aprovado.
              </Notice>
            ) : (
              <Card style={{ gap: 14 }}>
                <AuthField
                  label="Nome do app"
                  icon="download"
                  value={installName}
                  onChangeText={(v) => { setInstallName(v); setInstallFeedback(null); }}
                  maxLength={80}
                  placeholder="Ex.: Duolingo"
                  testID="install-request-name"
                />
                {installFeedback ? <Notice icon={installFeedback.tone === 'success' ? 'check-circle' : 'alert-circle'} tone={installFeedback.tone}>{installFeedback.text}</Notice> : null}
                <Button label="Pedir para instalar" icon="send" onPress={() => void handleRequestInstall()} loading={installSending}
                  disabled={!installName.trim() || isOffline} testID="install-request-submit" />
              </Card>
            )}
          </>
        ) : null}

        {overview.routines.length > 0 ? (
          <>
            <SectionTitle>Suas rotinas</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {overview.routines.map((routine, i) => (
                <View key={routine.id} style={[styles.routine, { opacity: routine.enabled ? 1 : 0.5 }, i < overview.routines.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={[styles.routineIcon, { backgroundColor: colors.blueSoft }]}>
                    <Icon name={iconName(routine.icon, 'clock')} size={18} color={colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.appName, { color: colors.foreground }]}>{routine.title}{routine.enabled ? '' : ' (pausada)'}</Text>
                    <Text style={[styles.appDetail, { color: colors.mutedForeground }]}>
                      {routine.startTime} às {routine.endTime} · {formatDays(routine.days)}{routine.lockScreen && Platform.OS === 'android' ? ' · a tela apaga' : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionTitle>O que sua família vê</SectionTitle>
        <Card style={{ gap: 10 }}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Este aparelho está conectado à conta da sua família. Nada é escondido de você:
          </Text>
          {overview.collectedData.map((item) => (
            <View key={item} style={styles.bullet}>
              <Icon name="eye" size={16} color={colors.primary} />
              <Text style={[styles.body, { color: colors.foreground, flex: 1 }]}>{item}</Text>
            </View>
          ))}
          <View style={styles.bullet}>
            <Icon name="lock" size={16} color={colors.success} />
            <Text style={[styles.body, { color: colors.foreground, flex: 1 }]}>Ninguém lê suas mensagens, fotos ou o que você digita.</Text>
          </View>
        </Card>

        <Pressable
          testID="open-guardian-area"
          accessibilityRole="button"
          onPress={() => router.push('/(child)/guardian')}
          style={({ pressed }) => [styles.guardianLink, { borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}
        >
          <Icon name="lock" size={16} color={colors.mutedForeground} />
          <Text style={[styles.guardianText, { color: colors.mutedForeground }]}>Área do responsável (com PIN)</Text>
        </Pressable>
        {Platform.OS !== 'web' ? (
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Ligações de emergência nunca são bloqueadas.</Text>
        ) : null}
      </ScrollView>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  greeting: { fontFamily: 'Montserrat_700Bold', fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'NunitoSans_500Medium', fontSize: 14.5, lineHeight: 20, marginTop: 2 },

  now: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nowIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nowTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16 },
  nowDetail: { fontFamily: 'NunitoSans_500Medium', fontSize: 13.5, lineHeight: 19, marginTop: 2 },

  appRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  appHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  appName: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, flexShrink: 1 },
  extra: { fontFamily: 'NunitoSans_700Bold', fontSize: 12 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  appDetail: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 12.5 },

  pending: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14.5, flex: 1 },

  group: { gap: 8 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  routine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  routineIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  body: { fontFamily: 'NunitoSans_500Medium', fontSize: 14, lineHeight: 20 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  guardianLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, paddingVertical: 14, borderTopWidth: 1, minHeight: 48 },
  guardianText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13.5 },
  footnote: { fontFamily: 'NunitoSans_500Medium', fontSize: 11.5, textAlign: 'center', marginTop: 2 },
});
