import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useCreatePairingCode } from '@workspace/api-client-react';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { Button, Card, Chip, Notice, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

const STEPS = {
  android: [
    'Instale o Família Segura no aparelho da criança (Google Play).',
    'Abra o app e toque em "Configurar este aparelho para a criança".',
    'Digite o código abaixo.',
    'Na Área do responsável, conclua: acesso ao uso, serviço de proteção, proteção contra desinstalação e bateria.',
  ],
  ios: [
    'A criança precisa estar no Compartilhamento Familiar da Apple (Ajustes > seu nome > Família). Se você não tem iPhone, crie uma conta Apple gratuita para ser o adulto da família.',
    'Instale o Família Segura no iPhone/iPad da criança (App Store).',
    'Abra o app, toque em "Configurar este aparelho para a criança" e digite o código abaixo.',
    'Na Área do responsável, toque em "Configurar a proteção", autorize com a sua conta Apple e escolha os apps de cada regra.',
  ],
};

export default function PairDeviceScreen() {
  const colors = useColors();
  const { data } = useFamily();
  const createCode = useCreatePairingCode();
  const [platform, setPlatform] = useState<'android' | 'ios'>('android');
  const [code, setCode] = useState<{ code: string; expiresAt: string; childName: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const generate = () => {
    if (!data.childId) return;
    createCode.mutate({ data: { childId: data.childId } }, {
      onSuccess: (result) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCode({ code: result.code, expiresAt: String(result.expiresAt), childName: data.childName });
      },
      onError: (error) => showApiError(error),
    });
  };

  const remaining = code ? Math.max(0, new Date(code.expiresAt).getTime() - now) : 0;
  const expired = code !== null && remaining === 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  const limits = data.limits;

  return (
    <Screen back title="Parear aparelho" subtitle="O aparelho da criança pode ser iPhone ou Android, independente do seu celular.">
      <View style={{ height: 16 }} />
      <ChildSwitcher />
      {limits && (
        <Text style={[styles.limit, { color: colors.mutedForeground }]}>
          {limits.devices} de {limits.maxDevices} aparelhos em uso na família.
        </Text>
      )}

      <SectionTitle>Aparelho da criança</SectionTitle>
      <View style={styles.row}>
        <Chip label="Android" selected={platform === 'android'} onPress={() => setPlatform('android')} />
        <Chip label="iPhone / iPad" selected={platform === 'ios'} onPress={() => setPlatform('ios')} />
      </View>

      <Card style={{ gap: 12, marginTop: 14 }}>
        {STEPS[platform].map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: colors.secondary }]}><Text style={[styles.stepNumText, { color: colors.secondaryForeground }]}>{index + 1}</Text></View>
            <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Código para {data.childName}</SectionTitle>
      {code && !expired ? (
        <Card style={{ alignItems: 'center', gap: 8 }}>
          <Text accessibilityLabel={`Código ${code.code.split('').join(' ')}`} style={[styles.code, { color: colors.foreground }]} selectable>{code.code}</Text>
          <Text style={[styles.expiry, { color: colors.mutedForeground }]}>Válido por {mm}:{ss} · uso único</Text>
          <Button label="Compartilhar código" variant="secondary" icon="share-2" onPress={() => void Share.share({ message: `Código do Família Segura para ${code.childName}: ${code.code}` })} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </Card>
      ) : (
        <Button label={expired ? 'Gerar novo código' : 'Gerar código'} icon="key" loading={createCode.isPending} onPress={generate} testID="pair-generate" />
      )}

      <View style={{ height: 20 }} />
      <Notice icon="lock">O código vale por 15 minutos e só pode ser usado uma vez. O aparelho recebe uma credencial própria, que você pode revogar a qualquer momento.</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  limit: { fontFamily: 'Nunito_500Medium', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  stepText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 20 },
  code: { fontFamily: 'Fredoka_600SemiBold', fontSize: 38, letterSpacing: 4 },
  expiry: { fontFamily: 'Nunito_500Medium', fontSize: 13 },
});
