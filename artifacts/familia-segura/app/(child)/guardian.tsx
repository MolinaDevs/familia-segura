import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { checkGuardianPin } from '@/services/guardianPin';
import { clearChildDevice, loadCachedOverview, runChildSync } from '@/services/childSync';
import { unregisterChildBackgroundSync } from '@/services/backgroundSync';
import { removeAndroidDeviceAdmin, setAndroidGuardianUnlock } from '@/services/androidParentalControls';

const UNLOCK_MINUTES = 15;

/**
 * Área do responsável no aparelho da criança: tudo que desliga ou afrouxa a proteção passa pelo PIN.
 * Sem PIN definido pela família, mostra as opções com um aviso (a proteção contra desinstalação fica inativa).
 */
export default function GuardianAreaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCachedOverview().then((cached) => {
      const exists = Boolean(cached?.policy.pinVerifier);
      setHasPin(exists);
      if (!exists) setUnlocked(true);
    });
  }, []);

  const submit = async () => {
    if (pin.length < 4) return;
    setChecking(true);
    setError(null);
    const result = await checkGuardianPin(pin);
    setChecking(false);
    setPin('');
    if (result.valid) { setUnlocked(true); return; }
    if (result.lockedUntil) {
      const minutes = Math.max(1, Math.ceil((result.lockedUntil - Date.now()) / 60000));
      setError(`Muitas tentativas. Tente de novo em ${minutes} min. Sua família foi avisada.`);
      return;
    }
    setError('PIN incorreto.');
  };

  const unlockSettings = () => {
    setAndroidGuardianUnlock(UNLOCK_MINUTES);
    Alert.alert('Liberado', `As configurações do aparelho ficam liberadas por ${UNLOCK_MINUTES} minutos.`);
  };

  const unpair = () => {
    Alert.alert(
      'Desvincular este aparelho',
      'A proteção será desligada e o aparelho deixará de seguir as regras da família. Para voltar, será preciso um novo código de pareamento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'android') removeAndroidDeviceAdmin();
            await unregisterChildBackgroundSync();
            await clearChildDevice();
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.nav}>
        <Pressable testID="guardian-back" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={23} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Área do responsável</Text>
        <View style={{ width: 23 }} />
      </View>

      {hasPin === null && <ActivityIndicator color={colors.primary} />}

      {hasPin && !unlocked && (
        <View style={styles.pinBox}>
          <Feather name="lock" size={28} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Digite o PIN do responsável</Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>Só quem tem o PIN pode mudar a proteção deste aparelho.</Text>
          <TextInput
            testID="guardian-pin-input"
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            onSubmitEditing={submit}
            style={[styles.pinInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
          />
          {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
          <Pressable disabled={pin.length < 4 || checking} onPress={submit} style={[styles.primary, { backgroundColor: colors.primary, opacity: pin.length < 4 || checking ? 0.5 : 1 }]}>
            {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Entrar</Text>}
          </Pressable>
        </View>
      )}

      {unlocked && (
        <View style={{ gap: 12 }}>
          {!hasPin && (
            <View style={[styles.warning, { backgroundColor: colors.muted }]}>
              <Feather name="alert-triangle" size={18} color={colors.accent} />
              <Text style={[styles.detail, { color: colors.foreground, flex: 1 }]}>
                Sua família ainda não definiu um PIN. Defina no app do responsável (Configurações) para ativar a proteção contra desinstalação.
              </Text>
            </View>
          )}
          <Option icon="shield" title="Configurar a proteção" detail="Permissões do sistema, administrador e bateria." onPress={() => router.push(Platform.OS === 'ios' ? '/(child)/ios-controls' : '/(child)/android-controls')} />
          {Platform.OS === 'android' && hasPin && (
            <Option icon="unlock" title={`Liberar configurações por ${UNLOCK_MINUTES} min`} detail="Permite mexer nas Configurações do Android sem bloqueio." onPress={unlockSettings} />
          )}
          <Option icon="refresh-cw" title="Sincronizar agora" detail="Busca as regras mais recentes da família." onPress={() => void runChildSync().then(() => Alert.alert('Pronto', 'Regras atualizadas.'))} />
          <Option icon="log-out" title="Desvincular este aparelho" detail="Desliga a proteção e remove o aparelho da família." destructive onPress={unpair} />
        </View>
      )}
    </ScrollView>
  );

  function Option({ icon, title, detail, onPress, destructive }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; detail: string; onPress: () => void; destructive?: boolean }) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.option, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.8 }]}>
        <Feather name={icon} size={20} color={destructive ? colors.destructive : colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionTitle, { color: destructive ? colors.destructive : colors.foreground }]}>{title}</Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>{detail}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  navTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  pinBox: { alignItems: 'center', gap: 12, marginTop: 24 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, textAlign: 'center' },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  pinInput: { width: 220, height: 60, borderWidth: 1, borderRadius: 16, textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center' },
  primary: { width: 220, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  warning: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, alignItems: 'flex-start' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 18, padding: 16 },
  optionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 2 },
});
