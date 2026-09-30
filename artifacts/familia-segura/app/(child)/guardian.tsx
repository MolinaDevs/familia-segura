import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { reloadAppAsync } from 'expo';
import { goBack } from '@/lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { checkGuardianPin } from '@/services/guardianPin';
import { clearChildDevice, deviceAuthHeaders, loadCachedOverview, runChildSync } from '@/services/childSync';
import { unpairOwnDevice } from '@workspace/api-client-react';
import { unregisterChildBackgroundSync } from '@/services/backgroundSync';
import { removeAndroidDeviceAdmin, setAndroidGuardianUnlock } from '@/services/androidParentalControls';
import { unlockIosInstallations } from '@/services/iosDeviceProtection';

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
    // Sincroniza antes: um PIN recém-definido pela família precisa valer aqui (não confiar só no cache).
    runChildSync()
      .catch(() => null)
      .then(() => loadCachedOverview())
      .then((cached) => {
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
    if (result.valid) {
      setUnlocked(true);
      // Libera as Configurações do Android enquanto o responsável configura/ajusta o aparelho.
      if (Platform.OS === 'android') setAndroidGuardianUnlock(UNLOCK_MINUTES);
      return;
    }
    if (result.lockedUntil) {
      const minutes = Math.max(1, Math.ceil((result.lockedUntil - Date.now()) / 60000));
      setError(`Muitas tentativas. Tente de novo em ${minutes} min. Sua família foi avisada.`);
      return;
    }
    setError('PIN incorreto.');
  };

  const unlockSettings = async () => {
    if (Platform.OS === 'ios') {
      await unlockIosInstallations(UNLOCK_MINUTES, (await loadCachedOverview())?.policy ?? null);
      Alert.alert('Liberado', `A instalação de apps fica liberada por ${UNLOCK_MINUTES} minutos.`);
      return;
    }
    setAndroidGuardianUnlock(UNLOCK_MINUTES);
    Alert.alert('Liberado', `As configurações, a loja e a instalação de apps ficam liberadas por ${UNLOCK_MINUTES} minutos.`);
  };

  const unpair = () => {
    Alert.alert(
      'Desvincular este aparelho',
      'A proteção será desligada, o aparelho deixará de seguir as regras da família e os responsáveis serão avisados. Para voltar, será preciso um novo código de pareamento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            // Avisa o servidor primeiro: revoga a credencial e notifica os responsáveis.
            const headers = await deviceAuthHeaders();
            if (headers) await unpairOwnDevice({ headers }).catch(() => undefined);
            if (Platform.OS === 'android') removeAndroidDeviceAdmin();
            await unregisterChildBackgroundSync();
            await clearChildDevice();
            // Recarrega para sair do modo criança (volta a exigir login do responsável).
            await reloadAppAsync().catch(() => router.replace('/'));
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.nav}>
        <Pressable testID="guardian-back" onPress={() => goBack('/(child)')} hitSlop={10}>
          <Icon name="arrow-left" size={23} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Área do responsável</Text>
        <View style={{ width: 23 }} />
      </View>

      {hasPin === null && <ActivityIndicator color={colors.primary} />}

      {hasPin && !unlocked && (
        <View style={styles.pinBox}>
          <Icon name="lock" size={28} color={colors.primary} />
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
            {checking ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Entrar</Text>}
          </Pressable>
        </View>
      )}

      {unlocked && (
        <View style={{ gap: 12 }}>
          {!hasPin && (
            <View style={[styles.warning, { backgroundColor: colors.muted }]}>
              <Icon name="alert-triangle" size={18} color={colors.accent} />
              <Text style={[styles.detail, { color: colors.foreground, flex: 1 }]}>
                Sua família ainda não definiu um PIN. Defina no app do responsável (Configurações) para proteger esta área e impedir a desinstalação. Qualquer ação aqui é avisada aos responsáveis.
              </Text>
            </View>
          )}
          <Option icon="shield" title="Configurar a proteção" detail="Permissões do sistema, administrador e bateria." onPress={() => router.push(Platform.OS === 'ios' ? '/(child)/ios-controls' : '/(child)/android-controls')} />
          {hasPin && (
            <Option
              icon="unlock"
              title={Platform.OS === 'ios' ? `Liberar instalação de apps por ${UNLOCK_MINUTES} min` : `Liberar configurações por ${UNLOCK_MINUTES} min`}
              detail={Platform.OS === 'ios' ? 'Permite instalar um app aprovado por você.' : 'Libera Configurações, loja e instalação de apps sem bloqueio.'}
              onPress={() => void unlockSettings()}
            />
          )}
          <Option icon="refresh-cw" title="Sincronizar agora" detail="Busca as regras mais recentes da família." onPress={() => void runChildSync().then(() => Alert.alert('Pronto', 'Regras atualizadas.'))} />
          <Option icon="log-out" title="Desvincular este aparelho" detail="Desliga a proteção e remove o aparelho da família." destructive onPress={unpair} />
        </View>
      )}
    </ScrollView>
  );

  function Option({ icon, title, detail, onPress, destructive }: { icon: React.ComponentProps<typeof Icon>['name']; title: string; detail: string; onPress: () => void; destructive?: boolean }) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.option, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.8 }]}>
        <Icon name={icon} size={20} color={destructive ? colors.destructive : colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionTitle, { color: destructive ? colors.destructive : colors.foreground }]}>{title}</Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>{detail}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  navTitle: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  pinBox: { alignItems: 'center', gap: 12, marginTop: 24 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 20, textAlign: 'center' },
  detail: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 19 },
  pinInput: { width: 220, height: 60, borderWidth: 1, borderRadius: 16, textAlign: 'center', fontFamily: 'Montserrat_700Bold', fontSize: 26, letterSpacing: 8 },
  error: { fontFamily: 'NunitoSans_500Medium', fontSize: 13, textAlign: 'center' },
  primary: { width: 220, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  warning: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, alignItems: 'flex-start' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 18, padding: 16 },
  optionTitle: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15, marginBottom: 2 },
});
