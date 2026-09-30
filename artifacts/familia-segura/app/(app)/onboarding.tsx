import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getGetFamilyOverviewQueryKey, useAcceptInvite, useCreateFamily } from '@workspace/api-client-react';
import { applyAgePreset } from '@/lib/agePresets';
import { openLegal } from '@/lib/legal';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { AuthButton, AuthCard, AuthField, AuthHeader, AuthShell, FormMessage } from '@/components/auth/AuthKit';

// Mesma faixa da edição de criança (child-edit): 1 a 19 anos — a API aceita nascidos a partir de 2006.
const MIN_CHILD_AGE = 1;
const MAX_CHILD_AGE = 19;

/** Idade da criança em anos: número inteiro na faixa aceita. */
function ageError(value: string) {
  if (!value) return null;
  const age = Number(value);
  if (!/^\d{1,2}$/.test(value) || age < MIN_CHILD_AGE || age > MAX_CHILD_AGE) return `Use a idade em anos, de ${MIN_CHILD_AGE} a ${MAX_CHILD_AGE}.`;
  return null;
}

function StepDots({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  return (
    <View style={styles.dots} accessibilityLabel={`Passo ${step} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i < step ? colors.primary : colors.border, width: i === step - 1 ? 28 : 10 }]} />
      ))}
      <Text style={[styles.dotsText, { color: colors.mutedForeground }]}>Passo {step} de {total}</Text>
    </View>
  );
}

function Consent({ checked, onToggle, children, testID }: { checked: boolean; onToggle: () => void; children: React.ReactNode; testID?: string }) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.consentRow, { borderColor: checked ? colors.primary : colors.input, backgroundColor: checked ? colors.secondary : colors.background }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? colors.primary : colors.mutedForeground, backgroundColor: checked ? colors.primary : 'transparent' }]}>
        {checked ? <Icon name="check" size={14} color={colors.primaryForeground} /> : null}
      </View>
      <Text style={[styles.consentText, { color: colors.foreground }]}>{children}</Text>
    </Pressable>
  );
}

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const createFamily = useCreateFamily();
  const acceptInvite = useAcceptInvite();
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleNext = async () => {
    if (step === 1) {
      if (!familyName || !guardianName) return;
      setStep(2);
    } else {
      if (!childName.trim() || !childAge || ageError(childAge) || !consentAccepted) return;
      setLoading(true);
      setSubmitError(null);
      try {
        const family = await createFamily.mutateAsync({
          data: {
            name: familyName.trim(),
            guardianName: guardianName.trim(),
            childName: childName.trim(),
            childBirthYear: new Date().getFullYear() - parseInt(childAge, 10),
            consentAccepted,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        });
        // Sugestão por idade (autonomia progressiva). Falha aqui não impede o cadastro.
        const child = family.children[0];
        if (child && child.ageBand !== 'adulto') {
          await applyAgePreset(child.id, child.ageBand, family.routines).catch(() => 0);
        }
        await queryClient.invalidateQueries({ queryKey: getGetFamilyOverviewQueryKey() });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Família nova: boas-vindas em 4 telas antes do painel (o guia "Primeiros passos" continua lá).
        router.replace('/(app)/welcome-tour');
      } catch (err: unknown) {
        console.error(err);
        setSubmitError('Não deu para criar a família agora. Confira a internet e tente de novo — nada foi salvo pela metade.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
      }
    }
  };

  const joinWithInvite = async () => {
    if (!inviteCode || !guardianName || !consentAccepted) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const family = await acceptInvite.mutateAsync({ data: { code: inviteCode.trim(), displayName: guardianName.trim(), consentAccepted } });
      queryClient.setQueryData(getGetFamilyOverviewQueryKey(), family);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)');
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setSubmitError(status === 409 ? 'Não deu para entrar: a família já está no limite de responsáveis, ou você já participa de outra família.' : 'Esse convite não funcionou. Ele pode ter expirado: peça um novo a quem criou a família.');
      setLoading(false);
    }
  };

  const ageProblem = ageError(childAge);
  const canContinue = step === 1
    ? Boolean(familyName.trim() && guardianName.trim())
    : Boolean(childName.trim() && childAge && !ageProblem && consentAccepted);

  if (inviteMode) {
    return (
      <AuthShell onBack={() => { setInviteMode(false); setSubmitError(null); }} backLabel="Voltar para criar uma família">
        <AuthHeader
          icon="user-plus"
          title="Entrar numa família"
          subtitle="Quem criou a família gera o convite em Família → Responsáveis. Digite o código aqui."
        />
        <AuthCard>
          <AuthField
            label="Código do convite"
            icon="key"
            value={inviteCode}
            onChangeText={(t) => { setInviteCode(t.toUpperCase()); setSubmitError(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABCDE23456"
            style={styles.code}
            testID="onboarding-invite-code"
          />
          <AuthField
            label="Como você quer ser chamado"
            icon="user"
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="Ex.: Marina"
            autoCapitalize="words"
          />
          <Consent checked={consentAccepted} onToggle={() => setConsentAccepted((a) => !a)}>
            Sou responsável pelas crianças desta família e li a Política de Privacidade.
          </Consent>
          {submitError ? <FormMessage tone="error">{submitError}</FormMessage> : null}
          <AuthButton label="Entrar na família" onPress={() => void joinWithInvite()} loading={loading}
            disabled={!inviteCode.trim() || !guardianName.trim() || !consentAccepted} testID="onboarding-join" />
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell onBack={step === 2 ? () => { setStep(1); setSubmitError(null); } : undefined} backLabel="Voltar ao passo 1">
      <StepDots step={step} total={2} />
      {step === 1 ? (
        <AuthHeader title="Vamos montar a sua família" subtitle="Dois passos rápidos. Tudo pode ser mudado depois." />
      ) : (
        <AuthHeader icon="smile" title="Quem vamos acompanhar?"
          subtitle="Com a idade, sugerimos limites e rotinas adequados — você ajusta como quiser depois." />
      )}

      <AuthCard>
        {step === 1 ? (
          <>
            <AuthField
              label="Nome da família"
              icon="house"
              value={familyName}
              onChangeText={setFamilyName}
              placeholder="Ex.: Família Andrade"
              autoCapitalize="words"
              returnKeyType="next"
              testID="onboarding-family-name"
            />
            <AuthField
              label="Como você quer ser chamado"
              icon="user"
              value={guardianName}
              onChangeText={setGuardianName}
              placeholder="Ex.: Marina"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => void handleNext()}
              helper="É assim que a criança e os outros responsáveis vão ver você."
              testID="onboarding-guardian-name"
            />
          </>
        ) : (
          <>
            <AuthField
              label="Nome da criança"
              icon="smile"
              value={childName}
              onChangeText={(text) => { setChildName(text); setSubmitError(null); }}
              placeholder="Ex.: Leo"
              autoCapitalize="words"
              testID="onboarding-child-name"
            />
            <AuthField
              label="Idade"
              icon="hash"
              value={childAge}
              onChangeText={(text) => { setChildAge(text.replace(/\D/g, '').slice(0, 2)); setSubmitError(null); }}
              placeholder="Em anos"
              keyboardType="number-pad"
              error={ageProblem}
              testID="onboarding-child-age"
            />
            <Consent testID="onboarding-consent" checked={consentAccepted} onToggle={() => { setConsentAccepted((a) => !a); setSubmitError(null); }}>
              Declaro ser pai, mãe ou responsável legal por esta criança e autorizo, em nome dela, o tratamento dos dados
              necessários ao controle parental (tempo de uso por app, apps instalados, estado da proteção dos aparelhos),
              conforme o art. 14 da LGPD e a Política de Privacidade, e aceito os Termos de Uso. Posso exportar ou apagar
              tudo quando quiser.
            </Consent>
            <View style={styles.legalLinks}>
              <Pressable onPress={() => void openLegal('privacy')} hitSlop={8} accessibilityRole="link">
                <Text style={[styles.link, { color: colors.primary }]}>Política de Privacidade</Text>
              </Pressable>
              <Pressable onPress={() => void openLegal('terms')} hitSlop={8} accessibilityRole="link">
                <Text style={[styles.link, { color: colors.primary }]}>Termos de Uso</Text>
              </Pressable>
            </View>
          </>
        )}

        {submitError ? <FormMessage tone="error">{submitError}</FormMessage> : null}

        <AuthButton
          label={step === 1 ? 'Continuar' : 'Criar a família'}
          onPress={() => void handleNext()}
          loading={loading}
          disabled={!canContinue}
          testID="onboarding-next"
        />
      </AuthCard>

      {step === 1 ? (
        <Pressable onPress={() => setInviteMode(true)} style={({ pressed }) => [styles.inviteLink, pressed && { opacity: 0.7 }]} testID="onboarding-have-invite" accessibilityRole="button">
          <Icon name="user-plus" size={18} color={colors.primary} />
          <Text style={[styles.link, { color: colors.primary }]}>Recebi um convite de outro responsável</Text>
        </Pressable>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  dot: { height: 6, borderRadius: 3 },
  dotsText: { fontFamily: 'NunitoSans_700Bold', fontSize: 12, marginLeft: 6 },
  code: { fontFamily: 'Montserrat_700Bold', fontSize: 18, letterSpacing: 3 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  consentText: { flex: 1, fontFamily: 'NunitoSans_500Medium', fontSize: 13, lineHeight: 19 },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  link: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  inviteLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginTop: 8, minHeight: 48 },
});
