import React from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExportFamilyDataQueryKey, useDeleteAccount, useExportFamilyData } from '@workspace/api-client-react';
import { useChildColor } from '@/components/charts';
import { Button, Card, Divider, Row, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';
import { openLegal } from '@/lib/legal';

const STATE_TEXT: Record<string, string> = {
  active: 'Protegido', partial: 'Proteção incompleta', disabled: 'Proteção desligada', unavailable: 'Sem suporte', unknown: 'Aguardando',
};

export default function FamilyScreen() {
  const colors = useColors();
  const childColor = useChildColor();
  const { signOut } = useAuth();
  const { data, overview, canEdit, refetch } = useFamily();
  const { hasPremiumAccess } = useSubscription();
  const exportData = useExportFamilyData({ query: { queryKey: getExportFamilyDataQueryKey(), enabled: false } });
  const deleteAccount = useDeleteAccount();
  const limits = data.limits;
  const isOwner = data.role === 'owner';

  const handleExport = async () => {
    const res = await exportData.refetch();
    if (res.error || !res.data) { showApiError(res.error, 'Falha ao exportar dados.'); return; }
    await Share.share({ message: JSON.stringify(res.data, null, 2) });
  };

  const handleDelete = () => {
    const message = isOwner
      ? 'Sua conta e todos os dados da família (crianças, aparelhos, regras e relatórios) serão apagados, e os aparelhos das crianças deixam de ser controlados. Esta ação é irreversível. Se houver assinatura, cancele também na App Store ou no Google Play: a exclusão não interrompe a cobrança da loja.'
      : 'Sua conta será apagada e você sairá desta família. As crianças e as regras continuam com os demais responsáveis. Esta ação é irreversível.';
    Alert.alert('Excluir minha conta', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir tudo', style: 'destructive', onPress: async () => {
          try {
            await deleteAccount.mutateAsync();
            const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('@familia-segura'));
            await AsyncStorage.multiRemove(keys);
            await signOut();
          } catch (error) {
            showApiError(error, 'Não foi possível excluir a conta.');
          }
        },
      },
    ]);
  };

  return (
    <Screen tabs eyebrow="Família" title={overview?.family.name ?? 'Minha família'} onRefresh={refetch}>
      <SectionTitle action={canEdit && limits && limits.children < limits.maxChildren ? '+ Criança' : undefined} onAction={() => router.push('/(app)/child-edit')}>
        {`Crianças${limits ? ` (${limits.children}/${limits.maxChildren})` : ''}`}
      </SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {data.children.map((child, index) => {
          const devices = data.allDevices.filter((d) => d.childId === child.id);
          return (
            <View key={child.id}>
              {index > 0 && <Divider />}
              <Row
                title={child.displayName}
                detail={`${new Date().getFullYear() - child.birthYear} anos · ${devices.length === 0 ? 'nenhum aparelho' : `${devices.length} aparelho(s)`}`}
                right={<View style={[styles.avatar, { backgroundColor: childColor(child.color) }]}><Text style={styles.initial}>{child.displayName[0]?.toUpperCase()}</Text></View>}
                onPress={canEdit ? () => router.push({ pathname: '/(app)/child-edit', params: { id: child.id } }) : undefined}
              />
            </View>
          );
        })}
      </Card>
      {canEdit && limits && limits.children >= limits.maxChildren && limits.plan === 'free' && (
        <Button label="Adicionar mais crianças com o Premium" variant="ghost" onPress={() => router.push('/(app)/subscription')} />
      )}

      <SectionTitle action={canEdit ? '+ Parear' : undefined} onAction={() => router.push('/(app)/pair-device')}>
        {`Aparelhos${limits ? ` (${limits.devices}/${limits.maxDevices})` : ''}`}
      </SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {data.allDevices.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>Nenhum aparelho pareado.</Text>}
        {data.allDevices.map((device, index) => {
          const child = data.children.find((c) => c.id === device.childId);
          return (
            <View key={device.id}>
              {index > 0 && <Divider />}
              <Row icon="smartphone"
                iconColor={device.protectionState === 'active' && device.online ? colors.success : device.protectionState === 'disabled' ? colors.destructive : colors.warning}
                title={`${device.name} · ${child?.displayName ?? ''}`}
                detail={`${device.platform === 'ios' ? 'iPhone/iPad' : 'Android'} · ${STATE_TEXT[device.protectionState] ?? device.protectionState}${device.online ? '' : ' · sem contato'}`}
                onPress={() => router.push({ pathname: '/(app)/device/[id]', params: { id: device.id } })} />
            </View>
          );
        })}
      </Card>

      <SectionTitle>Conta e família</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="users" title="Responsáveis" detail={`${overview?.members.length ?? 1} pessoa(s) · convide o outro responsável`} onPress={() => router.push('/(app)/members')} />
        <Divider />
        <Row icon="star" title={hasPremiumAccess || limits?.plan === 'premium' ? 'Família Segura Premium' : 'Conheça o Premium'}
          detail="Até 10 crianças e 10 aparelhos" onPress={() => router.push('/(app)/subscription')} />
        <Divider />
        <Row icon="sliders" title="Configurações e proteção" detail="PIN, instalação/remoção de apps, filtro web" onPress={() => router.push('/(app)/settings')} />
      </Card>

      <SectionTitle>Privacidade (LGPD)</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="download" title="Exportar dados da família" detail="Cópia em formato JSON" onPress={() => void handleExport()} />
        <Divider />
        <Row icon="file-text" title="Política de privacidade" onPress={() => void openLegal('privacy')} />
        <Divider />
        <Row icon="book" title="Termos de uso" onPress={() => void openLegal('terms')} />
        <Divider />
        <Row icon="trash-2" destructive title="Excluir minha conta"
          detail={isOwner ? 'Apaga a conta e todos os dados da família' : 'Apaga a sua conta e sai da família'} onPress={handleDelete} />
      </Card>

      <Button label="Sair da conta" variant="secondary" icon="log-out" onPress={() => void signOut()} style={{ marginTop: 24 }} />
      {Platform.OS === 'web' && <Text style={[styles.empty, { color: colors.mutedForeground }]}>Versão web: use o app para parear aparelhos.</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 13 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: 14 },
});
