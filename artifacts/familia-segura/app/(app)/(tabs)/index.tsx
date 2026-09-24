import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useResolveTimeRequest, useUpdateDeviceApp } from '@workspace/api-client-react';
import { AppIcon } from '@/components/AppIcon';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { StatusPill } from '@/components/StatusPill';
import { Button, Card, formatMinutes, Notice, Row, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

const EVENT_LABEL: Record<string, string> = {
  protection_disabled: 'Proteção desligada',
  tamper_attempt: 'Tentativa de mexer na proteção',
  uninstall_attempt: 'Tentativa de desinstalar',
  pin_failed: 'PIN errado no aparelho',
};

export default function HomeScreen() {
  const colors = useColors();
  const { data, overview, totalUsage, usagePercent, canEdit, refetch, isOffline } = useFamily();
  const resolveRequest = useResolveTimeRequest();
  const updateDeviceApp = useUpdateDeviceApp();
  const attentionApps = useMemo(() => data.apps.filter((app) => app.status !== 'permitido' || (app.effectiveLimit > 0 && app.usageToday >= app.effectiveLimit * 0.8)).slice(0, 3), [data.apps]);
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const activeRoutine = data.routines.find((routine) => routine.enabled);
  const pendingRequests = data.timeRequests.filter((r) => r.status === 'pending');
  const deviceName = (id: string) => data.allDevices.find((d) => d.id === id)?.name ?? 'aparelho';
  const childName = (deviceId: string) => {
    const device = data.allDevices.find((d) => d.id === deviceId);
    return data.children.find((c) => c.id === device?.childId)?.displayName ?? '';
  };
  const unhealthy = data.allDevices.filter((d) => d.protectionState === 'disabled' || d.protectionState === 'partial' || !d.online);
  const alerts = data.recentEvents.filter((e) => EVENT_LABEL[e.type] && Date.now() - new Date(e.occurredAt).getTime() < 48 * 3600_000).slice(0, 3);

  const steps = [
    { done: Boolean(overview?.settings.hasGuardianPin), title: 'Definir o PIN do responsável', detail: 'Necessário para impedir desinstalação.', go: () => router.push('/(app)/settings') },
    { done: data.allDevices.length > 0, title: 'Parear o aparelho da criança', detail: 'iPhone ou Android.', go: () => router.push('/(app)/pair-device') },
    { done: data.apps.length > 1, title: 'Escolher os apps e limites', detail: 'Use o catálogo ou os apps instalados.', go: () => router.push('/(app)/add-app') },
  ];
  const showSteps = canEdit && steps.some((s) => !s.done);

  const resolve = (requestId: string, status: 'approved' | 'denied') => {
    void Haptics.selectionAsync();
    resolveRequest.mutate({ requestId, data: { status } }, { onSuccess: () => refetch(), onError: (e) => showApiError(e) });
  };
  const decideApp = (deviceId: string, packageName: string, status: 'approved' | 'blocked') => {
    void Haptics.selectionAsync();
    updateDeviceApp.mutate({ deviceId, packageName, data: { status } }, { onSuccess: () => refetch(), onError: (e) => showApiError(e) });
  };

  return (
    <Screen tabs eyebrow={today} title="Olá, família." onRefresh={refetch}
      right={undefined}>
      <View style={{ height: 16 }} />
      <ChildSwitcher />
      {isOffline && <View style={{ marginBottom: 12 }}><Notice icon="wifi-off" tone="warning">Sem conexão. Mostrando os últimos dados salvos; alterações ficam pausadas.</Notice></View>}

      {showSteps && (
        <Card style={{ marginBottom: 20 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Primeiros passos</Text>
          {steps.map((step) => (
            <Row key={step.title} icon={step.done ? 'check-circle' : 'circle'} iconColor={step.done ? colors.success : colors.mutedForeground}
              title={step.title} detail={step.done ? 'Concluído' : step.detail} onPress={step.done ? undefined : step.go} />
          ))}
        </Card>
      )}

      {(unhealthy.length > 0 || alerts.length > 0) && (
        <View style={{ gap: 8, marginBottom: 20 }}>
          {unhealthy.slice(0, 3).map((d) => (
            <Pressable key={d.id} onPress={() => router.push({ pathname: '/(app)/device/[id]', params: { id: d.id } })}>
              <Notice icon="alert-triangle" tone={d.protectionState === 'disabled' ? 'danger' : 'warning'}>
                {`${d.name} (${data.children.find((c) => c.id === d.childId)?.displayName ?? ''}): `}
                {!d.online ? 'sem contato há algum tempo' : d.protectionState === 'disabled' ? 'proteção desligada' : `proteção incompleta${d.protectionIssues[0] ? ` — ${d.protectionIssues[0]}` : ''}`}
              </Notice>
            </Pressable>
          ))}
          {alerts.map((e) => (
            <Notice key={e.id} icon="shield-off" tone="danger">
              {`${EVENT_LABEL[e.type]} · ${childName(e.deviceId)} (${deviceName(e.deviceId)}) · ${new Date(e.occurredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`}
            </Notice>
          ))}
        </View>
      )}

      {pendingRequests.length > 0 && (
        <>
          <SectionTitle>Pedidos de tempo</SectionTitle>
          <View style={{ gap: 10 }}>
            {pendingRequests.slice(0, 5).map((req) => (
              <Card key={req.id}>
                <Text style={[styles.reqTitle, { color: colors.foreground }]}>{req.childName} pediu +{req.requestedMinutes} min de {req.appName}</Text>
                {req.message ? <Text style={[styles.reqMsg, { color: colors.mutedForeground }]}>“{req.message}”</Text> : null}
                {canEdit && (
                  <View style={styles.actions}>
                    <Button label="Negar" variant="secondary" onPress={() => resolve(req.id, 'denied')} style={{ flex: 1 }} />
                    <Button label="Liberar hoje" onPress={() => resolve(req.id, 'approved')} style={{ flex: 1 }} testID={`approve-${req.id}`} />
                  </View>
                )}
              </Card>
            ))}
          </View>
        </>
      )}

      {data.pendingApps.length > 0 && (
        <>
          <SectionTitle>Apps novos aguardando você</SectionTitle>
          <View style={{ gap: 10 }}>
            {data.pendingApps.slice(0, 5).map((app) => (
              <Card key={app.id}>
                <Text style={[styles.reqTitle, { color: colors.foreground }]}>{app.label}</Text>
                <Text style={[styles.reqMsg, { color: colors.mutedForeground }]}>Instalado em {deviceName(app.deviceId)} ({childName(app.deviceId)}) · bloqueado até você decidir</Text>
                {canEdit && (
                  <View style={styles.actions}>
                    <Button label="Manter bloqueado" variant="destructive" onPress={() => decideApp(app.deviceId, app.packageName, 'blocked')} style={{ flex: 1 }} />
                    <Button label="Aprovar" onPress={() => decideApp(app.deviceId, app.packageName, 'approved')} style={{ flex: 1 }} />
                  </View>
                )}
              </Card>
            ))}
          </View>
        </>
      )}

      {data.devices.length === 0 ? (
        <Card style={{ gap: 12, marginTop: 20 }}>
          <View style={[styles.setupIcon, { backgroundColor: colors.secondary }]}><Feather name="smartphone" size={26} color={colors.secondaryForeground} /></View>
          <Text style={[styles.setupTitle, { color: colors.foreground }]}>Espaço de {data.childName}</Text>
          <Text style={[styles.reqMsg, { color: colors.mutedForeground }]}>Conecte o aparelho de {data.childName} para acompanhar o uso e aplicar as proteções. Funciona com iPhone e Android, independente do seu celular.</Text>
          {canEdit && <Button label="Parear aparelho" icon="link" onPress={() => router.push('/(app)/pair-device')} testID="home-pair-device" />}
        </Card>
      ) : (
        <>
          <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <Text style={[styles.heroEyebrow, { color: colors.primaryForeground }]}>HOJE · {data.childName.toUpperCase()}</Text>
            <View style={styles.heroRow}>
              <View>
                <Text style={[styles.heroLabel, { color: colors.primaryForeground }]}>Tempo total</Text>
                <Text style={[styles.heroValue, { color: colors.primaryForeground }]}>{formatMinutes(totalUsage)}</Text>
              </View>
              <View style={[styles.circle, { borderColor: colors.primaryForeground }]}>
                <Text style={[styles.circleValue, { color: colors.primaryForeground }]}>{usagePercent}%</Text>
                <Text style={[styles.circleLabel, { color: colors.primaryForeground }]}>do limite</Text>
              </View>
            </View>
            <View style={[styles.heroTrack, { backgroundColor: colors.primaryForeground + '33' }]}>
              <View style={[styles.heroProgress, { width: `${usagePercent}%`, backgroundColor: colors.accent }]} />
            </View>
          </View>

          <SectionTitle action="Ver todos" onAction={() => router.push('/(app)/(tabs)/apps')}>Atenção hoje</SectionTitle>
          <View style={{ gap: 10 }}>
            {attentionApps.map((app) => (
              <Card key={app.id} onPress={() => router.push({ pathname: '/app/[id]', params: { id: app.id } })} style={styles.appRow}>
                <AppIcon name={app.icon} color={app.iconColor} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reqTitle, { color: colors.foreground }]}>{app.name}</Text>
                  <Text style={[styles.reqMsg, { color: colors.mutedForeground }]}>{app.status === 'bloqueado' && !app.extraToday ? 'Acesso bloqueado' : `${app.usageToday} de ${app.effectiveLimit} min`}</Text>
                </View>
                <StatusPill status={app.status} />
              </Card>
            ))}
            {attentionApps.length === 0 && <Notice icon="smile" tone="success">Tudo tranquilo por enquanto.</Notice>}
          </View>

          <SectionTitle action="Ajustar" onAction={() => router.push('/(app)/(tabs)/routine')}>Rotina</SectionTitle>
          {activeRoutine ? (
            <Card style={styles.appRow}>
              <Feather name={(activeRoutine.icon || 'moon') as React.ComponentProps<typeof Feather>['name']} size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.reqTitle, { color: colors.foreground }]}>{activeRoutine.title}</Text>
                <Text style={[styles.reqMsg, { color: colors.mutedForeground }]}>{activeRoutine.start} às {activeRoutine.end}</Text>
              </View>
            </Card>
          ) : <Notice icon="moon">Nenhuma pausa programada para {data.childName}.</Notice>}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  reqTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  reqMsg: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  setupIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  setupTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  hero: { borderRadius: 26, padding: 22, marginTop: 8 },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, opacity: 0.8 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 },
  heroLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, opacity: 0.8 },
  heroValue: { fontFamily: 'Inter_700Bold', fontSize: 38, letterSpacing: -1.4, marginTop: 4 },
  circle: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
  circleValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  circleLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, opacity: 0.8 },
  heroTrack: { height: 10, borderRadius: 10, overflow: 'hidden', marginTop: 20 },
  heroProgress: { height: '100%', borderRadius: 10 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
