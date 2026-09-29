import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { router, useLocalSearchParams } from 'expo-router';
import {
  getListDeviceAppsQueryKey, useListDeviceApps, useRevokeDevice, useUnlockDeviceInstalls, useUpdateDevice, useUpdateDeviceApp,
} from '@workspace/api-client-react';
import { Button, Card, Chip, Divider, EmptyState, Notice, Row, Screen, SectionTitle, Toggle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

import { goBack } from '@/lib/navigation';
const STATE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  active: { label: 'Proteção ativa', tone: 'success' },
  partial: { label: 'Proteção incompleta', tone: 'warning' },
  disabled: { label: 'Proteção desligada', tone: 'danger' },
  unavailable: { label: 'Aparelho sem suporte', tone: 'danger' },
  unknown: { label: 'Aguardando o aparelho enviar o estado', tone: 'neutral' },
};

export default function DeviceScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, canEdit, refetch } = useFamily();
  const device = data.allDevices.find((d) => d.id === id);
  const [name, setName] = useState(device?.name ?? '');
  // Aberto por link direto, os dados chegam depois do primeiro render.
  useEffect(() => { if (device && !name) setName(device.name); }, [device?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [filter, setFilter] = useState<'all' | 'pending' | 'blocked'>('all');
  const updateDevice = useUpdateDevice();
  const revokeDevice = useRevokeDevice();
  const updateApp = useUpdateDeviceApp();
  const unlockInstalls = useUnlockDeviceInstalls();
  const apps = useListDeviceApps(id ?? '', { query: { queryKey: getListDeviceAppsQueryKey(id ?? ''), enabled: Boolean(id) && device?.platform === 'android' } });

  if (!device) {
    return <Screen back><EmptyState icon="smartphone" title="Aparelho não encontrado" detail="Ele pode ter sido revogado." /></Screen>;
  }
  const child = data.children.find((c) => c.id === device.childId);
  const state = STATE[device.protectionState] ?? STATE.unknown;
  const done = { onSuccess: () => { refetch(); }, onError: (error: unknown) => showApiError(error) };

  const revoke = () => Alert.alert('Revogar aparelho?', 'As regras param de valer neste aparelho e ele sai da família. Para voltar, gere um novo código.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Revogar', style: 'destructive', onPress: () => revokeDevice.mutate({ deviceId: device.id }, { onSuccess: () => { refetch(); goBack('/(app)/(tabs)/profile'); }, onError: (e) => showApiError(e) }) },
  ]);

  const list = (apps.data ?? []).filter((a) => filter === 'all' || a.status === filter);

  return (
    <Screen back title={device.name} subtitle={`${device.platform === 'ios' ? 'iPhone/iPad' : 'Android'} de ${child?.displayName ?? ''}${device.model ? ` · ${device.model}` : ''}`}>
      <View style={{ height: 16 }} />
      <Notice icon={state.tone === 'success' ? 'shield' : 'alert-triangle'} tone={state.tone}>
        {state.label}{Date.now() - new Date(device.lastSeenAt).getTime() > 3 * 3600_000 ? ` · sem contato desde ${new Date(device.lastSeenAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
      </Notice>
      {device.protectionIssues.length > 0 && (
        <Card style={{ marginTop: 12, gap: 4 }}>
          {device.protectionIssues.map((issue) => <Text key={issue} style={[styles.issue, { color: colors.foreground }]}>• {issue}</Text>)}
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Resolva no aparelho: Área do responsável → Configurar a proteção.</Text>
        </Card>
      )}

      <Card style={{ marginTop: 12 }}>
        <Row icon="clock" title="Último contato" detail={new Date(device.lastSeenAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} />
        <Divider />
        <Row icon="battery" title="Bateria" detail={device.batteryLevel != null ? `${device.batteryLevel}%` : 'Não informado'} />
        <Divider />
        <Row icon="cpu" title="Sistema" detail={`${device.platform === 'ios' ? 'iOS' : 'Android'} ${device.osVersion ?? ''} · app ${device.appVersion ?? '—'}`} />
      </Card>

      {canEdit && (
        <>
          <SectionTitle>Instalar apps</SectionTitle>
          <Card style={{ gap: 10 }}>
            {device.installUnlockUntil ? (
              <>
                <Notice icon="unlock" tone="warning">
                  {`Instalação liberada até ${new Date(device.installUnlockUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`}
                </Notice>
                <Button label="Bloquear agora" variant="secondary" icon="lock" loading={unlockInstalls.isPending}
                  onPress={() => unlockInstalls.mutate({ deviceId: device.id, data: { minutes: 0 } }, done)} />
              </>
            ) : (
              <>
                <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 0 }]}>
                  {device.platform === 'ios'
                    ? 'No iPhone a instalação fica bloqueada. Libere por alguns minutos para a criança instalar um app que você aprovou (a Apple não permite aprovar app por app).'
                    : 'A loja fica bloqueada e apps novos aguardam sua aprovação. Libere por alguns minutos para instalar um app combinado: o que for instalado nesse período já entra aprovado.'}
                </Text>
                <View style={styles.chips}>
                  {[15, 30, 60].map((minutes) => (
                    <Chip key={minutes} label={`Liberar ${minutes} min`}
                      onPress={() => unlockInstalls.mutate({ deviceId: device.id, data: { minutes } }, done)} />
                  ))}
                </View>
              </>
            )}
          </Card>

          <SectionTitle>Nome do aparelho</SectionTitle>
          <View style={styles.inline}>
            <TextInput value={name} onChangeText={setName} maxLength={80} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} />
            <Button label="Salvar" variant="secondary" disabled={!name.trim() || name === device.name}
              onPress={() => updateDevice.mutate({ deviceId: device.id, data: { name: name.trim() } }, done)} />
          </View>

          {data.children.length > 1 && (
            <>
              <SectionTitle>Pertence a</SectionTitle>
              <View style={styles.chips}>
                {data.children.map((c) => (
                  <Chip key={c.id} label={c.displayName} selected={c.id === device.childId}
                    onPress={() => c.id !== device.childId && updateDevice.mutate({ deviceId: device.id, data: { childId: c.id } }, done)} />
                ))}
              </View>
            </>
          )}
        </>
      )}

      {device.platform === 'android' && (
        <>
          <SectionTitle>Apps instalados</SectionTitle>
          <View style={[styles.chips, { marginBottom: 12 }]}>
            <Chip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Aguardando" selected={filter === 'pending'} onPress={() => setFilter('pending')} />
            <Chip label="Bloqueados" selected={filter === 'blocked'} onPress={() => setFilter('blocked')} />
          </View>
          {apps.isLoading && <ActivityIndicator color={colors.primary} />}
          <Card style={{ paddingVertical: 4 }}>
            {list.map((app, index) => (
              <View key={app.id}>
                {index > 0 && <Divider />}
                <Row title={app.label} detail={app.status === 'pending' ? 'Novo · aguardando você' : app.status === 'blocked' ? 'Bloqueado' : 'Liberado'}
                  right={canEdit ? (
                    <Toggle accessibilityLabel={`${app.label} liberado`} value={app.status === 'approved'}
                      onValueChange={(on) => updateApp.mutate({ deviceId: device.id, packageName: app.packageName, data: { status: on ? 'approved' : 'blocked' } }, {
                        onSuccess: () => { void apps.refetch(); refetch(); }, onError: (e) => showApiError(e),
                      })} />
                  ) : undefined} />
              </View>
            ))}
            {!apps.isLoading && list.length === 0 && <Text style={[styles.hint, { color: colors.mutedForeground, padding: 16, textAlign: 'center' }]}>Nada por aqui.</Text>}
          </Card>
        </>
      )}

      {canEdit && <Button label="Revogar aparelho" variant="destructive" onPress={revoke} style={{ marginTop: 28 }} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  issue: { fontFamily: 'Nunito_500Medium', fontSize: 14 },
  hint: { fontFamily: 'Nunito_400Regular', fontSize: 12, marginTop: 6 },
  inline: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Nunito_500Medium', fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
