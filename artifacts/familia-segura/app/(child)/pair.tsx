import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePairDevice } from '@workspace/api-client-react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useColors } from '@/hooks/useColors';
import { AuthButton, AuthCard, AuthField, AuthHeader, AuthShell, FormMessage, TrustNote } from '@/components/auth/AuthKit';
import { goBack } from '@/lib/navigation';

/** "abcd2345" → "ABCD-2345" enquanto digita (o código tem 8 caracteres). */
function formatCode(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: colors.blueSoft }]}>
        <Text style={[styles.stepNumberText, { color: colors.navy }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.foreground }]}>{children}</Text>
    </View>
  );
}

export default function PairDeviceScreen() {
  const router = useRouter();
  const pairDevice = usePairDevice();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = code.replace(/[^A-Z0-9]/g, '');
  const ready = normalized.length === 8;

  const handlePair = async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pairDevice.mutateAsync({
        data: {
          code: normalized,
          name: Platform.OS === 'ios' ? 'iPhone' : 'Android',
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          osVersion: String(Platform.Version),
          appVersion: Constants.expoConfig?.version,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      await AsyncStorage.setItem('childMode', 'true');
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('deviceId', result.device.id);
        await SecureStore.setItemAsync('childId', result.device.childId);
        await SecureStore.setItemAsync('deviceToken', result.deviceToken);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Próximo passo: o responsável conclui a configuração da proteção neste aparelho.
      router.replace('/(child)/guardian');
    } catch (err) {
      const status = (err as { status?: number }).status;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        !status ? 'Sem conexão com o servidor. Confira a internet e tente de novo.'
          : status === 409 ? 'A família já está no limite de aparelhos. O responsável pode remover um aparelho antigo em Família.'
          : status === 429 ? 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
          : 'Esse código não funcionou. Cada código vale 15 minutos e só uma vez: peça um novo ao responsável.',
      );
      setLoading(false);
    }
  };

  return (
    <AuthShell onBack={() => goBack('/')} backLabel="Voltar ao início">
      <AuthHeader
        title="Conectar este aparelho"
        subtitle="Leva um minuto. Depois disso, as regras combinadas pela família passam a valer aqui."
      />

      <AuthCard>
        <Step n={1}>No celular do responsável, abra <Text style={styles.strong}>Família</Text> e toque em <Text style={styles.strong}>+ Parear</Text>.</Step>
        <Step n={2}>Digite abaixo o código de 8 letras e números que aparecer.</Step>

        <AuthField
          label="Código de pareamento"
          icon="link"
          value={code}
          onChangeText={(value) => { setCode(formatCode(value)); setError(null); }}
          placeholder="ABCD-2345"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={9}
          returnKeyType="go"
          onSubmitEditing={() => void handlePair()}
          style={styles.code}
          testID="pair-code"
        />

        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <AuthButton label="Conectar" onPress={() => void handlePair()} loading={loading} disabled={!ready} testID="pair-submit" />
      </AuthCard>

      <TrustNote />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontFamily: 'Montserrat_700Bold', fontSize: 13 },
  stepText: { flex: 1, fontFamily: 'NunitoSans_500Medium', fontSize: 15, lineHeight: 22 },
  strong: { fontFamily: 'NunitoSans_800ExtraBold' },
  code: { fontFamily: 'Montserrat_700Bold', fontSize: 22, letterSpacing: 4 },
});
