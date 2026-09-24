import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, AppState, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useCreateTimeRequest, useGetChildOverview, getGetChildOverviewQueryKey, useSyncChildUsage, useSyncChildProtection, type ChildOverview } from '@workspace/api-client-react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { applyNativePolicies, getAllowedUsageSamples } from '@/services/iosParentalControls';
import { applyAndroidPolicies, clearAndroidPolicies, getAndroidProtectionSummary, getAndroidUsageSamples } from '@/services/androidParentalControls';

export default function ChildDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const createRequest = useCreateTimeRequest();
  const syncUsage = useSyncChildUsage();
  const syncProtection = useSyncChildProtection();
  
  const { data: childData, isLoading: isFetching, isError, isSuccess, isFetchedAfterMount, dataUpdatedAt, error, refetch } = useGetChildOverview({
    query: {
      queryKey: getGetChildOverviewQueryKey(),
      retry: false,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [message, setMessage] = useState('');
  const [cachedData, setCachedData] = useState<ChildOverview | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const appliedAndroidPolicyAt = useRef(0);

  useEffect(() => {
    SecureStore.getItemAsync('deviceId').then((deviceId) => {
      const key = deviceId ? `@familia-segura/child-overview_${deviceId}` : null;
      setCacheKey(key);
      if (!key) {
        setCacheReady(true);
        return;
      }
      AsyncStorage.getItem(key)
        .then((stored) => {
          if (stored) setCachedData(JSON.parse(stored) as ChildOverview);
        })
        .finally(() => setCacheReady(true));
    });
  }, []);

  useEffect(() => {
    if (childData && cacheKey) {
      setCachedData(childData);
      AsyncStorage.setItem(cacheKey, JSON.stringify(childData)).catch(() => {});
    }
  }, [childData, cacheKey]);

  useEffect(() => {
    const status = (error as { status?: number } | null)?.status;
    if (isError && (status === 401 || status === 403)) {
      if (Platform.OS === 'android') clearAndroidPolicies();
      AsyncStorage.removeItem('childMode').catch(() => {});
      if (cacheKey) AsyncStorage.removeItem(cacheKey).catch(() => {});
      SecureStore.deleteItemAsync('deviceId').catch(() => {});
      SecureStore.deleteItemAsync('childId').catch(() => {});
      SecureStore.deleteItemAsync('deviceToken').catch(() => {});
      router.replace('/(child)/pair');
    }
  }, [isError, error, cacheKey, router]);

  const visibleData = childData ?? cachedData;
  const isOffline = isError && Boolean(cachedData);

  useEffect(() => {
    if (
      Platform.OS !== 'android'
      || !childData
      || !isSuccess
      || !isFetchedAfterMount
      || dataUpdatedAt <= appliedAndroidPolicyAt.current
    ) return;
    applyAndroidPolicies(childData.apps, childData.routines);
    appliedAndroidPolicyAt.current = dataUpdatedAt;
  }, [childData, isSuccess, isFetchedAfterMount, dataUpdatedAt]);

  useEffect(() => {
    if (!visibleData) return;
    let cancelled = false;
    const sync = async () => {
      if (Platform.OS === 'ios') {
        await applyNativePolicies(visibleData.apps, visibleData.routines);
      } else if (Platform.OS === 'android') {
        const protection = getAndroidProtectionSummary();
        if (!isOffline) syncProtection.mutate({ data: { state: protection.state, issues: protection.issues } });
      }
      if (isOffline || cancelled) return;
      const samples = Platform.OS === 'ios'
        ? await getAllowedUsageSamples(visibleData.apps)
        : Platform.OS === 'android'
          ? getAndroidUsageSamples(visibleData.apps)
          : [];
      if (samples.length > 0 && !cancelled) syncUsage.mutate({ data: { samples } });
    };
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refetch();
        void sync();
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [visibleData, isOffline, refetch]);

  const handleRequestTime = async () => {
    if (!appId || !minutes || isOffline) return;
    setLoading(true);
    try {
      const childId = await SecureStore.getItemAsync('childId') || 'unknown';
      const requestedApp = visibleData?.apps.find((app) =>
        app.appId.toLocaleLowerCase('pt-BR') === appId.trim().toLocaleLowerCase('pt-BR')
        || app.appName.toLocaleLowerCase('pt-BR') === appId.trim().toLocaleLowerCase('pt-BR'));
      await createRequest.mutateAsync({
        data: {
          childId,
          appId: requestedApp?.appId ?? appId.trim(),
          requestedMinutes: parseInt(minutes, 10),
          message
        }
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Enviado", "Seu pedido de tempo extra foi enviado para sua família.");
      setAppId('');
      setMinutes('');
      setMessage('');
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível enviar o pedido.");
    } finally {
      setLoading(false);
    }
  };

  if ((isFetching || !cacheReady) && !visibleData) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!visibleData) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Feather name="wifi-off" size={30} color={colors.mutedForeground} />
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center', marginTop: 12 }]}>
          Não foi possível carregar seus combinados agora. Tente novamente quando a conexão voltar.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.foreground }]}>Olá, {visibleData.child.displayName}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Acompanhe o que você faz e por quanto tempo.</Text>
        {isOffline && <Text style={[styles.offlineText, { color: colors.mutedForeground }]}>Sem conexão · consulta disponível, alterações pausadas</Text>}
      </View>

      <View style={[styles.card, { backgroundColor: colors.secondary }]}>
        <View style={styles.cardHeader}>
          <Feather name="eye" size={24} color={colors.secondaryForeground} />
          <Text style={[styles.cardTitle, { color: colors.secondaryForeground }]}>Transparência</Text>
        </View>
        <Text style={[styles.cardBody, { color: colors.secondaryForeground }]}>
          Seu aparelho está vinculado à conta da sua família. Eles podem ver quais aplicativos você usa e definir combinados sobre tempo de tela.
        </Text>
        
        {visibleData.collectedData && visibleData.collectedData.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.secondaryForeground, marginBottom: 4 }}>Dados compartilhados:</Text>
            {visibleData.collectedData.map((d, idx) => (
              <Text key={idx} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.secondaryForeground }}>• {d}</Text>
            ))}
          </View>
        )}
      </View>

      <Pressable
        testID={Platform.OS === 'android' ? 'open-android-controls' : 'open-ios-controls'}
        onPress={() => router.push(Platform.OS === 'android' ? '/(child)/android-controls' : '/(child)/ios-controls')}
        style={({ pressed }) => [styles.nativeControlCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
      >
        <View style={[styles.nativeControlIcon, { backgroundColor: colors.muted }]}><Feather name="shield" size={22} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.nativeControlTitle, { color: colors.foreground }]}>
            {Platform.OS === 'android' ? 'Proteção nativa no Android' : 'Proteção nativa no iPhone'}
          </Text>
          <Text style={[styles.nativeControlDetail, { color: colors.mutedForeground }]}>
            {Platform.OS === 'android' ? 'Configure o acesso ao uso e o serviço de proteção.' : 'Autorize a Apple e associe apps aos seus combinados.'}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>

      {visibleData.apps.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Seus Aplicativos</Text>
          <View style={{ gap: 8, marginBottom: 24 }}>
            {visibleData.apps.map(app => (
              <View key={app.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{app.appName}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.mutedForeground }}>
                  Status: {app.status} {app.dailyLimitMinutes ? `(${app.dailyLimitMinutes} min/dia)` : ''}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {visibleData.routines.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Suas Rotinas</Text>
          <View style={{ gap: 8, marginBottom: 24 }}>
            {visibleData.routines.map(routine => (
              <View key={routine.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, opacity: routine.enabled ? 1 : 0.5 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{routine.title}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.mutedForeground }}>
                  {routine.startTime} - {routine.endTime} ({routine.days})
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pedir mais tempo</Text>
      <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Para qual aplicativo?</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={appId}
            onChangeText={setAppId}
            placeholder="Ex: YouTube, TikTok"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Quantos minutos?</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={minutes}
            onChangeText={setMinutes}
            placeholder="Ex: 15"
            keyboardType="numeric"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Motivo (opcional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Preciso terminar um vídeo..."
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            (!appId || !minutes || loading || isOffline) && { opacity: 0.5 }
          ]}
          onPress={handleRequestTime}
          disabled={!appId || !minutes || loading || isOffline}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pedir tempo</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 30 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  offlineText: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 8 },
  card: { borderRadius: 20, padding: 20, marginBottom: 32 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  cardBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  nativeControlCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: -18, marginBottom: 28 },
  nativeControlIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nativeControlTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  nativeControlDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 16 },
  form: { borderRadius: 20, padding: 16, borderWidth: 1, gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 15 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
