import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator, Alert } from 'react-native';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { getExportFamilyDataQueryKey, useCreatePairingCode, useExportFamilyData, useDeleteFamily, useRevokeDevice, useResolveTimeRequest } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from '@/context/SubscriptionContext';

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function confirmAction(title: string, message: string, action: () => Promise<void>) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) void action();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: () => void action() },
    ]);
  }
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, refetch } = useFamily();
  const { signOut } = useAuth();
  const { hasPremiumAccess } = useSubscription();
  
  const createCode = useCreatePairingCode();
  const exportData = useExportFamilyData({ query: { queryKey: getExportFamilyDataQueryKey(), enabled: false } });
  const deleteFamily = useDeleteFamily();
  const revokeDevice = useRevokeDevice();
  const resolveTimeRequest = useResolveTimeRequest();
  
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const handleGenerateCode = async () => {
    try {
      if (!data.childId) {
        showMessage("Erro", "O perfil da criança ainda não foi carregado. Tente novamente.");
        return;
      }
      const result = await createCode.mutateAsync({ data: { childId: data.childId } });
      setPairingCode(result.code);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error(err);
      showMessage("Erro", "Não foi possível gerar código de pareamento.");
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportData.refetch();
      if (res.error) throw res.error;
      if (res.data && Platform.OS === 'web') {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'familia-segura-dados.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else if (res.data) {
        await Share.share({
          message: JSON.stringify(res.data, null, 2),
        });
      }
    } catch (err) {
      console.error(err);
      showMessage("Erro", "Falha ao exportar dados.");
    }
  };

  const handleDelete = () => {
    confirmAction("Excluir família", "Tem certeza de que deseja excluir todos os dados da família? Esta ação é irreversível.", async () => {
      try {
        await deleteFamily.mutateAsync();
        const keys = await AsyncStorage.getAllKeys();
        const familiaKeys = keys.filter(k => k.startsWith('@familia-segura'));
        await AsyncStorage.multiRemove(familiaKeys);
        await signOut();
      } catch (err) {
        console.error(err);
        showMessage("Erro", "Não foi possível excluir a família.");
      }
    });
  };

  const handleRevokeDevice = (deviceId: string) => {
    confirmAction("Remover dispositivo", "Tem certeza de que deseja remover este dispositivo?", async () => {
      try {
        await revokeDevice.mutateAsync({ deviceId });
        await refetch();
      } catch (err) {
        showMessage("Erro", "Falha ao remover dispositivo.");
      }
    });
  };

  const handleResolveRequest = async (requestId: string, status: 'approved' | 'denied') => {
    if (status === 'approved' && !hasPremiumAccess) {
      router.push('/(app)/subscription');
      return;
    }
    try {
      await resolveTimeRequest.mutateAsync({
        requestId,
        data: { status }
      });
      refetch();
    } catch (err) {
      showMessage("Erro", "Falha ao responder pedido.");
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16, paddingBottom: Platform.OS === 'web' ? 118 : insets.bottom + 100 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PERFIL DA FAMÍLIA</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Espaço seguro</Text>
        </View>
        <Pressable testID="profile-settings" onPress={() => router.push('/(app)/settings')} style={[styles.settingsButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="settings" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
        <View style={styles.avatar}><Text style={[styles.avatarText, { color: colors.primary }]}>{data.childName[0]}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileLabel}>Criança</Text>
          <Text style={styles.profileName}>{data.childName}</Text>
          <Text style={styles.profileAge}>{data.childAge} anos • {data.devices.length === 0 ? 'Nenhum celular' : `${data.devices.length} dispositivo(s)`}</Text>
        </View>
        <View style={styles.profileBadge}>
          <Feather name={data.devices.length === 0 ? 'smartphone' : 'shield'} size={20} color="#fff" />
        </View>
      </View>

      {pairingCode ? (
        <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={[styles.codeEyebrow, { color: colors.primary }]}>CÓDIGO DE PAREAMENTO</Text>
          <Text style={[styles.codeValue, { color: colors.foreground }]}>{pairingCode}</Text>
          <Text style={[styles.codeSub, { color: colors.mutedForeground }]}>Abra o Família Segura no aparelho da criança e informe este código (válido por 10 minutos).</Text>
        </View>
      ) : (
        <Pressable testID="profile-pair-device" disabled={createCode.isPending} onPress={handleGenerateCode} style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
          <View style={[styles.actionIcon, { backgroundColor: colors.secondary }]}><Feather name="link" size={20} color={colors.primary} /></View>
          <View style={styles.actionCopy}>
            <Text style={[styles.actionTitle, { color: colors.foreground }]}>Vincular dispositivo</Text>
            <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>Conecte o aparelho da criança</Text>
          </View>
          {createCode.isPending ? <ActivityIndicator color={colors.primary} /> : <Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
        </Pressable>
      )}

      {data.timeRequests && data.timeRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pedidos de Tempo Extra</Text>
          <View style={styles.list}>
            {data.timeRequests.filter(req => req.status === 'pending').map(req => (
              <View key={req.id} style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.requestTop}>
                  <Text style={[styles.requestApp, { color: colors.foreground }]}>{req.appName}</Text>
                  <Text style={[styles.requestTime, { color: colors.primary }]}>+{req.requestedMinutes} min</Text>
                </View>
                {req.message ? <Text style={[styles.requestMessage, { color: colors.mutedForeground }]}>"{req.message}"</Text> : null}
                <View style={styles.requestActions}>
                  <Pressable onPress={() => handleResolveRequest(req.id, 'denied')} style={[styles.reqBtn, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.reqBtnText, { color: colors.secondaryForeground }]}>Negar</Text>
                  </Pressable>
                  <Pressable onPress={() => handleResolveRequest(req.id, 'approved')} style={[styles.reqBtn, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.reqBtnText, { color: colors.primaryForeground }]}>{hasPremiumAccess ? 'Aprovar' : 'Premium'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {data.timeRequests.filter(req => req.status === 'pending').length === 0 && (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum pedido no momento.</Text>
            )}
          </View>
        </View>
      )}

      {data.devices && data.devices.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Aparelhos conectados</Text>
          <View style={styles.list}>
            {data.devices.map(device => (
              <View key={device.id} style={[styles.deviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.deviceInfo}>
                  <Text style={[styles.deviceName, { color: colors.foreground }]}>{device.name}</Text>
                  <Text style={[styles.deviceMeta, { color: colors.mutedForeground }]}>{device.platform} • Sincronizado: {new Date(device.lastSeenAt).toLocaleDateString()}</Text>
                  <Text style={[styles.deviceStatus, { color: device.protectionState === 'active' ? colors.primary : colors.destructive }]}>
                    {device.protectionState === 'active' ? 'Proteção ativa' : 'Proteção desativada'}
                  </Text>
                </View>
                <Pressable onPress={() => handleRevokeDevice(device.id)} style={styles.deviceDel}>
                  <Feather name="trash-2" size={20} color={colors.destructive} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Conta e Dados</Text>
        <View style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable onPress={handleExport} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, { borderBottomColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}><Feather name="download" size={18} color={colors.primary} /></View>
            <View style={styles.menuCopy}>
              <Text style={[styles.menuTitle, { color: colors.foreground }]}>Exportar dados</Text>
              <Text style={[styles.menuSubtitle, { color: colors.mutedForeground }]}>Baixe as informações da família</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => signOut()} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, { borderBottomColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}><Feather name="log-out" size={18} color={colors.primary} /></View>
            <View style={styles.menuCopy}>
              <Text style={[styles.menuTitle, { color: colors.foreground }]}>Sair da conta</Text>
              <Text style={[styles.menuSubtitle, { color: colors.mutedForeground }]}>Encerrar a sessão</Text>
            </View>
          </Pressable>
          <Pressable onPress={handleDelete} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, { borderBottomWidth: 0 }]}>
            <View style={[styles.menuIcon, { backgroundColor: '#FDEAE9' }]}><Feather name="trash-2" size={18} color={colors.destructive} /></View>
            <View style={styles.menuCopy}>
              <Text style={[styles.menuTitle, { color: colors.destructive }]}>Excluir família</Text>
              <Text style={[styles.menuSubtitle, { color: colors.mutedForeground }]}>Apagar todos os dados</Text>
            </View>
          </Pressable>
        </View>
      </View>
      
      <View style={styles.legalRow}>
        <Feather name="check-circle" size={16} color={colors.primary} />
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>Criado com foco em privacidade e transparência.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1.2 },
  settingsButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  
  profileCard: { borderRadius: 28, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  profileCopy: { flex: 1 },
  profileLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#fff', letterSpacing: -0.5 },
  profileAge: { fontFamily: 'Inter_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  profileBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  actionButton: { borderRadius: 20, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1 },
  actionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 2 },
  actionSub: { fontFamily: 'Inter_500Medium', fontSize: 13 },

  codeCard: { borderRadius: 24, padding: 28, marginBottom: 32, borderWidth: 2, alignItems: 'center' },
  codeEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.5, marginBottom: 16 },
  codeValue: { fontFamily: 'Inter_700Bold', fontSize: 46, letterSpacing: 8, marginBottom: 16 },
  codeSub: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  section: { marginBottom: 36 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginBottom: 16 },
  list: { gap: 12 },
  
  requestCard: { borderRadius: 20, borderWidth: 1, padding: 18 },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestApp: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  requestTime: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  requestMessage: { fontFamily: 'Inter_400Regular', fontSize: 14, fontStyle: 'italic', marginBottom: 16 },
  requestActions: { flexDirection: 'row', gap: 10 },
  reqBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reqBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 14 },

  deviceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 20, borderWidth: 1, padding: 20 },
  deviceInfo: { flex: 1 },
  deviceName: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  deviceMeta: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  deviceStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 },
  deviceDel: { padding: 10, marginRight: -10 },

  menu: { borderRadius: 24, borderWidth: 1, paddingHorizontal: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 1 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 2 },
  menuSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 13 },

  legalRow: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingBottom: 20 },
  legalText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  
  pressed: { opacity: 0.7 },
});