import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSetGuardianPin, useUpdateFamilySettings, type FamilySettingsUpdate } from '@workspace/api-client-react';
import { Button, Card, Chip, Divider, Notice, Row, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';
import { openLegal } from '@/lib/legal';
import { registerGuardianPush } from '@/services/push';

const LEASES = [
  { hours: 24, label: '1 dia' },
  { hours: 72, label: '3 dias' },
  { hours: 168, label: '7 dias' },
  { hours: 720, label: '30 dias' },
];

export default function SettingsScreen() {
  const colors = useColors();
  const { overview, canEdit, refetch } = useFamily();
  const { hasPremiumAccess } = useSubscription();
  const settings = overview?.settings;
  const updateSettings = useUpdateFamilySettings();
  const setPin = useSetGuardianPin();
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [editingPin, setEditingPin] = useState(false);

  const save = (patch: FamilySettingsUpdate) => updateSettings.mutate({ data: patch }, { onSuccess: () => refetch(), onError: (e) => showApiError(e) });

  const savePin = () => {
    if (pin !== pinConfirm) { Alert.alert('PIN diferente', 'Digite o mesmo PIN nos dois campos.'); return; }
    setPin.mutate({ data: { pin } }, {
      onSuccess: () => {
        setPinValue(''); setPinConfirm(''); setEditingPin(false); refetch();
        Alert.alert('PIN salvo', 'Os aparelhos das crianças recebem a proteção na próxima sincronização (em instantes).');
      },
      onError: (e) => showApiError(e),
    });
  };

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <Switch accessibilityLabel={label} value={value} disabled={!canEdit || updateSettings.isPending} onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} />
  );

  return (
    <Screen back title="Configurações" subtitle="Valem para todas as crianças e aparelhos da família.">
      <SectionTitle>PIN do responsável</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Text style={[styles.body, { color: colors.foreground }]}>
          {settings?.hasGuardianPin
            ? 'PIN definido. Ele é pedido no aparelho da criança para liberar configurações, instalar apps ou desvincular.'
            : 'Defina um PIN de 4 a 8 números. Sem ele, a proteção contra desinstalação fica inativa.'}
        </Text>
        {!settings?.hasGuardianPin && <Notice icon="alert-triangle" tone="warning">Proteção contra desinstalação inativa até você definir o PIN.</Notice>}
        {editingPin ? (
          <>
            <TextInput value={pin} onChangeText={(v) => setPinValue(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" secureTextEntry placeholder="Novo PIN"
              placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]} />
            <TextInput value={pinConfirm} onChangeText={(v) => setPinConfirm(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" secureTextEntry placeholder="Repita o PIN"
              placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]} />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Evite sequências (1234) e números repetidos (1111). Não conte o PIN para a criança.</Text>
            <Button label="Salvar PIN" onPress={savePin} disabled={pin.length < 4} loading={setPin.isPending} testID="pin-save" />
          </>
        ) : (
          canEdit && <Button label={settings?.hasGuardianPin ? 'Trocar PIN' : 'Definir PIN'} variant={settings?.hasGuardianPin ? 'secondary' : 'primary'} icon="lock" onPress={() => setEditingPin(true)} />
        )}
      </Card>

      {settings && (
        <>
          <SectionTitle>Proteção dos aparelhos</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            <Row icon="download" title="Bloquear instalação de apps" detail="iPhone: bloqueio da App Store. Android: loja e instalador bloqueados. Libere pelo PIN."
              right={toggle('Bloquear instalação de apps', settings.blockAppInstalls, (v) => save({ blockAppInstalls: v }))} />
            <Divider />
            <Row icon="trash-2" title="Bloquear remoção de apps" detail="A criança não apaga apps, inclusive o Família Segura."
              right={toggle('Bloquear remoção de apps', settings.blockAppRemoval, (v) => save({ blockAppRemoval: v }))} />
            <Divider />
            <Row icon="clock" title="Aprovar apps novos (Android)" detail="App instalado fica bloqueado até você aprovar."
              right={toggle('Aprovar apps novos', settings.quarantineNewApps, (v) => save({ quarantineNewApps: v }))} />
            <Divider />
            <Row icon="globe" title="Filtro de conteúdo adulto (iPhone)" detail="Usa o filtro da Apple nos navegadores."
              right={toggle('Filtro de conteúdo adulto', settings.webFilter === 'adult', (v) => save({ webFilter: v ? 'adult' : 'off' }))} />
          </Card>

          <SectionTitle>Sem internet</SectionTitle>
          <Text style={[styles.hint, { color: colors.mutedForeground, marginBottom: 10 }]}>
            Por quanto tempo o aparelho mantém as regras sem conseguir falar com o servidor. Depois disso a proteção é suspensa até reconectar.
          </Text>
          <View style={styles.chips}>
            {LEASES.map((l) => (
              <Chip key={l.hours} label={l.label} selected={settings.offlineLeaseHours === l.hours} onPress={() => canEdit && save({ offlineLeaseHours: l.hours })} />
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 10 }]}>Fuso da família: {settings.timezone}</Text>
        </>
      )}

      <SectionTitle>Notificações</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="bell" title="Ativar alertas neste celular" detail="Pedidos de tempo, apps novos e tentativas de desligar a proteção."
          onPress={() => void registerGuardianPush().then(() => Alert.alert('Pronto', 'Se você permitiu, os alertas chegam neste celular.'))} />
      </Card>

      <SectionTitle>Plano e ajuda</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="star" title={hasPremiumAccess ? 'Premium ativo' : 'Conheça o Premium'} onPress={() => router.push('/(app)/subscription')} />
        <Divider />
        <Row icon="help-circle" title="Suporte" onPress={() => void openLegal('support')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  input: { height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontFamily: 'Inter_600SemiBold', fontSize: 18, letterSpacing: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
