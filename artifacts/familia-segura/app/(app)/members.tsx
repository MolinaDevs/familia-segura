import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useCreateInvite, useRemoveMember, useUpdateMember, type FamilyMember } from '@workspace/api-client-react';
import { Button, Card, Chip, Divider, Notice, Row, Screen, SectionTitle } from '@/components/ui';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { showApiError } from '@/lib/apiErrors';

const ROLE_LABEL = { owner: 'Titular', guardian: 'Co-responsável', viewer: 'Observador' } as const;
const ROLE_DETAIL = {
  guardian: 'Pode mudar regras, aprovar pedidos e gerenciar aparelhos.',
  viewer: 'Só acompanha: vê uso e relatórios, sem alterar nada.',
};

export default function MembersScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { overview, data, refetch } = useFamily();
  const createInvite = useCreateInvite();
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();
  const [role, setRole] = useState<'guardian' | 'viewer'>('guardian');
  const [invite, setInvite] = useState<{ code: string; role: string; expiresAt: string } | null>(null);
  const members = overview?.members ?? [];
  const isOwner = data.role === 'owner';
  const limits = data.limits;

  const generate = () => createInvite.mutate({ data: { role } }, {
    onSuccess: (result) => setInvite({ code: result.code, role: result.role, expiresAt: String(result.expiresAt) }),
    onError: (error) => showApiError(error),
  });

  const manage = (member: FamilyMember) => {
    if (member.isCurrentUser && member.role !== 'owner') {
      Alert.alert('Sair da família?', 'Você deixará de acompanhar as crianças desta família.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => removeMember.mutate({ memberId: member.id }, { onSuccess: () => void signOut(), onError: (e) => showApiError(e) }) },
      ]);
      return;
    }
    if (!isOwner || member.role === 'owner') return;
    const other = member.role === 'guardian' ? 'viewer' : 'guardian';
    Alert.alert(member.displayName, ROLE_LABEL[member.role], [
      { text: `Tornar ${ROLE_LABEL[other].toLowerCase()}`, onPress: () => updateMember.mutate({ memberId: member.id, data: { role: other } }, { onSuccess: () => refetch(), onError: (e) => showApiError(e) }) },
      { text: 'Remover da família', style: 'destructive', onPress: () => removeMember.mutate({ memberId: member.id }, { onSuccess: () => refetch(), onError: (e) => showApiError(e) }) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <Screen back title="Responsáveis" subtitle={limits ? `${limits.guardians} de ${limits.maxGuardians} responsáveis no plano ${limits.plan === 'premium' ? 'Premium' : 'gratuito'}.` : undefined}>
      <SectionTitle>Quem acompanha</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {members.map((member, index) => (
          <View key={member.id}>
            {index > 0 && <Divider />}
            <Row icon={member.role === 'owner' ? 'star' : member.role === 'guardian' ? 'user-check' : 'eye'}
              title={`${member.displayName}${member.isCurrentUser ? ' (você)' : ''}`} detail={ROLE_LABEL[member.role]}
              onPress={(isOwner && member.role !== 'owner') || (member.isCurrentUser && member.role !== 'owner') ? () => manage(member) : undefined} />
          </View>
        ))}
      </Card>

      {isOwner && (
        <>
          <SectionTitle>Convidar</SectionTitle>
          <View style={styles.chips}>
            <Chip label="Co-responsável" selected={role === 'guardian'} onPress={() => setRole('guardian')} />
            <Chip label="Observador" selected={role === 'viewer'} onPress={() => setRole('viewer')} />
          </View>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>{ROLE_DETAIL[role]}</Text>
          {invite ? (
            <Card style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Text selectable style={[styles.code, { color: colors.foreground }]}>{invite.code}</Text>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>Válido até {new Date(invite.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · uso único</Text>
              <Button label="Compartilhar convite" icon="share-2" variant="secondary" style={{ alignSelf: 'stretch' }}
                onPress={() => void Share.share({ message: `Entre na nossa família no Família Segura: instale o app, crie sua conta e use o convite ${invite.code}` })} />
            </Card>
          ) : (
            <Button label="Gerar convite" icon="user-plus" onPress={generate} loading={createInvite.isPending} style={{ marginTop: 12 }} />
          )}
          <View style={{ marginTop: 16 }}>
            <Notice icon="info">Quem recebe o convite instala o Família Segura, cria a própria conta e escolhe "Tenho um convite". O celular do responsável pode ser iPhone ou Android.</Notice>
          </View>
        </>
      )}
      {!isOwner && <View style={{ marginTop: 20 }}><Notice icon="lock">Só o titular convida ou remove responsáveis.</Notice></View>}
      <Button label="Voltar" variant="ghost" onPress={() => router.back()} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 8 },
  code: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: 3 },
});
