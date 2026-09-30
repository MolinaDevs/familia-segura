import { Icon, iconName } from '@/components/Icon';
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

/** Saudação pela hora do dia (o app é aberto de manhã cedo e na hora de dormir). */
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bom dia!' : hour < 18 ? 'Boa tarde!' : 'Boa noite!';
}

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
  // Um alerta por aparelho, com o problema mais grave. "Sem contato" só após 3 h (a sincronização em
  // segundo plano do sistema pode levar ~15 min, e o celular desligado à noite é normal).
  const STALE_MS = 3 * 3600_000;
  const shortDate = (iso: string | Date) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  type DeviceAlert = { d: (typeof data.allDevices)[number]; tone: 'danger' | 'warning'; icon: 'shield-off' | 'wifi-off' | 'alert-triangle'; text: string };
  const deviceAlerts = data.allDevices.flatMap((d): DeviceAlert[] => {
    const childLabel = data.children.find((c) => c.id === d.childId)?.displayName ?? '';
    const tamper = data.recentEvents.find((e) => e.deviceId === d.id && EVENT_LABEL[e.type] && Date.now() - new Date(e.occurredAt).getTime() < 48 * 3600_000);
    const stale = Date.now() - new Date(d.lastSeenAt).getTime() > STALE_MS;
    if (d.protectionState === 'disabled') return [{ d, tone: 'danger', icon: 'shield-off', text: `${d.name} (${childLabel}): proteção desligada${stale ? ` · sem contato desde ${shortDate(d.lastSeenAt)}` : ''}` }];
    if (tamper) return [{ d, tone: 'danger', icon: 'shield-off', text: `${d.name} (${childLabel}): ${EVENT_LABEL[tamper.type].toLowerCase()} · ${shortDate(tamper.occurredAt)}` }];
    if (stale) return [{ d, tone: 'warning', icon: 'wifi-off', text: `${d.name} (${childLabel}): sem contato desde ${shortDate(d.lastSeenAt)}` }];
    if (d.protectionState === 'partial') return [{ d, tone: 'warning', icon: 'alert-triangle', text: `${d.name} (${childLabel}): proteção incompleta${d.protectionIssues[0] ? ` — ${d.protectionIssues[0]}` : ''}` }];
    return [];
  });

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
    <Screen tabs eyebrow={today} title={greeting()} onRefresh={refetch}
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

      {deviceAlerts.length > 0 && (
        <View style={{ gap: 8, marginBottom: 20 }}>
          {deviceAlerts.slice(0, 4).map(({ d, tone, icon, text }) => (
            <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(app)/device/[id]', params: { id: d.id } })}>
              <Notice icon={icon} tone={tone}>{text}</Notice>
            </Pressable>
          ))}
        </View>
      )}

      {pendingRequests.length > 0 && (
        <>
          <SectionTitle>Pedidos</SectionTitle>
          <View style={{ gap: 10 }}>
            {pendingRequests.slice(0, 5).map((req) => (
              <Card key={req.id}>
                <Text style={[styles.reqTitle, { color: colors.foreground }]}>
                  {req.kind === 'install' ? `${req.childName} quer instalar ${req.appName}` : `${req.childName} pediu +${req.requestedMinutes} min de ${req.appName}`}
                </Text>
                {req.message ? <Text style={[styles.reqMsg, { color: colors.mutedForeground }]}>“{req.message}”</Text> : null}
                {canEdit && (
                  <View style={styles.actions}>
                    <Button label="Negar" variant="secondary" onPress={() => resolve(req.id, 'denied')} style={{ flex: 1 }} />
                    <Button label={req.kind === 'install' ? `Liberar ${req.requestedMinutes} min` : 'Liberar hoje'} onPress={() => resolve(req.id, 'approved')} style={{ flex: 1 }} testID={`approve-${req.id}`} />
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
          <View style={[styles.setupIcon, { backgroundColor: colors.secondary }]}><Icon name="smartphone" size={26} color={colors.secondaryForeground} /></View>
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
              <Icon name={iconName(activeRoutine.icon, 'moon')} size={22} color={colors.primary} />
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
  cardTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 16, marginBottom: 4 },
  reqTitle: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  reqMsg: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  setupIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  setupTitle: { fontFamily: 'Montserrat_700Bold', fontSize: 20 },
  hero: { borderRadius: 26, padding: 22, marginTop: 8 },
  heroEyebrow: { fontFamily: 'NunitoSans_700Bold', fontSize: 11, letterSpacing: 1.4, opacity: 0.8 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 },
  heroLabel: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 12, opacity: 0.8 },
  heroValue: { fontFamily: 'Montserrat_700Bold', fontSize: 38, letterSpacing: -1.4, marginTop: 4 },
  circle: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
  circleValue: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  circleLabel: { fontFamily: 'NunitoSans_500Medium', fontSize: 10, opacity: 0.8 },
  heroTrack: { height: 10, borderRadius: 10, overflow: 'hidden', marginTop: 20 },
  heroProgress: { height: '100%', borderRadius: 10 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
