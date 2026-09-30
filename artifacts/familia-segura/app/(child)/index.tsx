import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, AppState, Platform, RefreshControl } from 'react-native';
import { Alert } from '@/lib/alert';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useCreateTimeRequest, type ChildOverview } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { loadCachedOverview, runChildSync, type SyncStatus } from '@/services/childSync';
import { registerChildBackgroundSync } from '@/services/backgroundSync';
import { registerChildPush } from '@/services/push';

const FOREGROUND_REFRESH_MS = 60_000;

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

  const handleRequestTime = async () => {
    if (!overview || !appId || !minutes || isOffline) return;
    setLoading(true);
    try {
      await createRequest.mutateAsync({
        data: { childId: overview.child.id, appId, requestedMinutes: parseInt(minutes, 10), message },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Enviado', 'Seu pedido de tempo extra foi enviado para sua família.');
      setAppId('');
      setMinutes('');
      setMessage('');
      void sync();
    } catch (err) {
      const code = (err as { status?: number }).status;
      Alert.alert('Erro', code === 409 ? 'Aguarde a resposta dos pedidos anteriores.' : 'Não foi possível enviar o pedido.');
    } finally {
      setLoading(false);
    }
  };

  // Pedido para instalar um app novo (a instalação fica bloqueada; o responsável libera por alguns minutos).
  const handleRequestInstall = async () => {
    if (!overview || !installName.trim() || isOffline) return;
    setInstallSending(true);
    try {
      await createRequest.mutateAsync({ data: { kind: 'install', childId: overview.child.id, appId: installName.trim(), requestedMinutes: 15, message: '' } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Enviado', 'Sua família vai receber o pedido. Quando aprovarem, você terá alguns minutos para instalar.');
      setInstallName('');
      void sync();
    } catch (err) {
      const code = (err as { status?: number }).status;
      Alert.alert('Erro', code === 409 ? 'Aguarde a resposta dos pedidos anteriores.' : 'Não foi possível enviar o pedido.');
    } finally {
      setInstallSending(false);
    }
  };
  const installUnlockedUntil = overview?.policy.installUnlockUntil ? new Date(overview.policy.installUnlockUntil) : null;

  if (!overview && status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!overview) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <Icon name="wifi-off" size={30} color={colors.mutedForeground} />
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Não foi possível carregar seus combinados agora. Tente novamente quando a conexão voltar.
        </Text>
        <Pressable onPress={() => void sync()} style={[styles.button, { backgroundColor: colors.primary, paddingHorizontal: 24 }]}>
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.foreground }]}>Olá, {overview.child.displayName}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Seu tempo de hoje e o que está combinado com a família.</Text>
        {isOffline && <Text style={[styles.offlineText, { color: colors.mutedForeground }]}>Sem internet: dá para consultar, e os pedidos saem quando voltar.</Text>}
      </View>

      <View style={[styles.card, { backgroundColor: colors.secondary }]}>
        <View style={styles.cardHeader}>
          <Icon name="eye" size={24} color={colors.secondaryForeground} />
          <Text style={[styles.cardTitle, { color: colors.secondaryForeground }]}>Transparência</Text>
        </View>
        <Text style={[styles.cardBody, { color: colors.secondaryForeground }]}>
          Seu aparelho está vinculado à conta da sua família. Eles veem quanto tempo você usa os apps e definem combinados sobre tempo de tela. Ninguém lê suas mensagens.
        </Text>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontFamily: 'NunitoSans_600SemiBold', fontSize: 13, color: colors.secondaryForeground, marginBottom: 4 }}>O que é compartilhado:</Text>
          {overview.collectedData.map((item) => (
            <Text key={item} style={{ fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.secondaryForeground }}>• {item}</Text>
          ))}
        </View>
      </View>

      {overview.apps.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Seus aplicativos</Text>
          <View style={{ gap: 8, marginBottom: 24 }}>
            {overview.apps.map((app) => (
              <View key={app.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={{ fontFamily: 'NunitoSans_600SemiBold', color: colors.foreground }}>{app.appName}</Text>
                <Text style={{ fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.mutedForeground }}>
                  {app.status === 'blocked' ? 'Bloqueado pela família' : `${app.usageTodayMinutes} de ${app.dailyLimitMinutes} min hoje`}
                  {app.extraTodayMinutes > 0 && app.status !== 'blocked' ? ` · +${app.extraTodayMinutes} min liberados hoje` : ''}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {overview.policy.pendingPackages.length > 0 && (
        <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card, marginBottom: 24 }]}>
          <Text style={{ fontFamily: 'NunitoSans_600SemiBold', color: colors.foreground }}>Apps aguardando aprovação</Text>
          <Text style={{ fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.mutedForeground }}>
            {overview.policy.pendingPackages.length} app(s) instalado(s) recentemente ficam bloqueados até sua família aprovar.
          </Text>
        </View>
      )}

      {overview.routines.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Suas rotinas</Text>
          <View style={{ gap: 8, marginBottom: 24 }}>
            {overview.routines.map((routine) => (
              <View key={routine.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card, opacity: routine.enabled ? 1 : 0.5 }]}>
                <Text style={{ fontFamily: 'NunitoSans_600SemiBold', color: colors.foreground }}>{routine.title}</Text>
                <Text style={{ fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.mutedForeground }}>
                  {routine.startTime} às {routine.endTime} · {formatDays(routine.days)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {overview.pendingRequests.length > 0 && (
        <View style={{ gap: 8, marginBottom: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Aguardando resposta</Text>
          {overview.pendingRequests.map((request) => (
            <View key={request.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ fontFamily: 'NunitoSans_600SemiBold', color: colors.foreground }}>
                {request.kind === 'install' ? `Instalar ${request.appName}` : `+${request.requestedMinutes} min de ${request.appName}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {overview.apps.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pedir mais tempo</Text>
          <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Para qual aplicativo?</Text>
              <View style={styles.chips}>
                {overview.apps.map((app) => (
                  <Pressable
                    key={app.id}
                    testID={`request-app-${app.appId}`}
                    onPress={() => setAppId(app.appId)}
                    style={[styles.chip, { borderColor: appId === app.appId ? colors.primary : colors.border, backgroundColor: appId === app.appId ? colors.secondary : colors.background }]}
                  >
                    <Text style={[styles.chipText, { color: appId === app.appId ? colors.primary : colors.foreground }]}>{app.appName}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Quantos minutos?</Text>
              <View style={styles.chips}>
                {['10', '15', '30', '45', '60'].map((value) => (
                  <Pressable
                    key={value}
                    testID={`request-minutes-${value}`}
                    onPress={() => setMinutes(value)}
                    style={[styles.chip, { borderColor: minutes === value ? colors.primary : colors.border, backgroundColor: minutes === value ? colors.secondary : colors.background }]}
                  >
                    <Text style={[styles.chipText, { color: minutes === value ? colors.primary : colors.foreground }]}>{value} min</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Motivo (opcional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={message}
                onChangeText={setMessage}
                maxLength={240}
                placeholder="Preciso terminar um trabalho..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.pressed, (!appId || !minutes || loading || isOffline) && { opacity: 0.5 }]}
              onPress={handleRequestTime}
              disabled={!appId || !minutes || loading || isOffline}
            >
              {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Pedir tempo</Text>}
            </Pressable>
          </View>
        </>
      )}

      {overview.policy.blockAppInstalls && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Quero instalar um app</Text>
          {installUnlockedUntil && installUnlockedUntil.getTime() > Date.now() ? (
            <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <Text style={{ fontFamily: 'NunitoSans_600SemiBold', color: colors.secondaryForeground }}>
                Instalação liberada até {installUnlockedUntil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ) : (
            <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                testID="install-request-name"
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={installName}
                onChangeText={setInstallName}
                maxLength={80}
                placeholder="Nome do app"
                placeholderTextColor={colors.mutedForeground}
              />
              <Pressable
                style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.pressed, (!installName.trim() || installSending || isOffline) && { opacity: 0.5 }]}
                onPress={handleRequestInstall}
                disabled={!installName.trim() || installSending || isOffline}
              >
                {installSending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Pedir para instalar</Text>}
              </Pressable>
            </View>
          )}
        </>
      )}

      <Pressable
        testID="open-guardian-area"
        onPress={() => router.push('/(child)/guardian')}
        style={({ pressed }) => [styles.guardianLink, { borderColor: colors.border }, pressed && styles.pressed]}
      >
        <Icon name="lock" size={16} color={colors.mutedForeground} />
        <Text style={[styles.guardianText, { color: colors.mutedForeground }]}>Área do responsável</Text>
      </Pressable>
      {Platform.OS !== 'web' && (
        <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Ligações de emergência nunca são bloqueadas.</Text>
      )}
    </ScrollView>
  );
}

const DAY_LABELS: Record<string, string> = { dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb' };
function formatDays(days: string) {
  const list = days.split(',').map((d) => d.trim()).filter(Boolean);
  if (list.length === 7) return 'todos os dias';
  return list.map((d) => DAY_LABELS[d] ?? d).join(', ');
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 30 },
  greeting: { fontFamily: 'Montserrat_700Bold', fontSize: 28, letterSpacing: -0.6, marginBottom: 8 },
  subtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22 },
  offlineText: { fontFamily: 'NunitoSans_500Medium', fontSize: 12, marginTop: 8 },
  card: { borderRadius: 20, padding: 20, marginBottom: 32 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 18 },
  cardBody: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21 },
  row: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 2 },
  sectionTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 18, marginBottom: 16 },
  form: { borderRadius: 20, padding: 16, borderWidth: 1, gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontFamily: 'NunitoSans_500Medium', fontSize: 14 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontFamily: 'NunitoSans_400Regular', fontSize: 15 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13 },
  guardianLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32, paddingVertical: 14, borderTopWidth: 1 },
  guardianText: { fontFamily: 'NunitoSans_500Medium', fontSize: 13 },
  footnote: { fontFamily: 'NunitoSans_400Regular', fontSize: 11, textAlign: 'center', marginTop: 4 },
});
