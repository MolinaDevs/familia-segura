import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getGetFamilyOverviewQueryKey, useAcceptInvite, useCreateFamily } from '@workspace/api-client-react';
import { applyAgePreset } from '@/lib/agePresets';
import { openLegal } from '@/lib/legal';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
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
      if (!childName || !childAge || !consentAccepted) return;
      setLoading(true);
      setSubmitError(null);
      try {
        const family = await createFamily.mutateAsync({
          data: {
            name: familyName,
            guardianName: guardianName,
            childName: childName,
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
        router.replace('/(app)');
      } catch (err: unknown) {
        console.error(err);
        setSubmitError('Não foi possível criar sua família. Verifique sua conexão e tente novamente.');
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
      const family = await acceptInvite.mutateAsync({ data: { code: inviteCode, displayName: guardianName, consentAccepted } });
      queryClient.setQueryData(getGetFamilyOverviewQueryKey(), family);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)');
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setSubmitError(status === 409 ? 'A família já atingiu o limite de responsáveis ou você já participa de outra família.' : 'Convite inválido ou expirado. Peça um novo ao titular da família.');
      setLoading(false);
    }
  };

  if (inviteMode) {
    return (
      <KeyboardAwareScrollViewCompat
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom + 20, 40), paddingHorizontal: 24, flexGrow: 1 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
            <Icon name="user-plus" size={32} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Entrar com convite</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Use o código que o titular da família gerou em Família → Responsáveis.</Text>
        </View>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Código do convite</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, letterSpacing: 3 }]}
              value={inviteCode} onChangeText={(t) => setInviteCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false}
              placeholder="ABCDE23456" placeholderTextColor={colors.mutedForeground} testID="onboarding-invite-code" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Seu nome</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={guardianName} onChangeText={setGuardianName} placeholder="Seu nome" placeholderTextColor={colors.mutedForeground} />
          </View>
          <Pressable onPress={() => setConsentAccepted((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: consentAccepted }}
            style={[styles.consentRow, { borderColor: consentAccepted ? colors.primary : colors.border, backgroundColor: colors.card }]}>
            <View style={[styles.checkbox, { borderColor: consentAccepted ? colors.primary : colors.mutedForeground, backgroundColor: consentAccepted ? colors.primary : 'transparent' }]}>
              {consentAccepted && <Icon name="check" size={14} color={colors.primaryForeground} />}
            </View>
            <Text style={[styles.consentText, { color: colors.foreground }]}>
              Declaro ser responsável pelas crianças desta família e li a Política de Privacidade.
            </Text>
          </Pressable>
          {submitError && (
            <View style={[styles.errorContainer, { backgroundColor: colors.dangerSoft, borderColor: colors.destructive }]}>
              <Icon name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{submitError}</Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <Pressable onPress={() => { setInviteMode(false); setSubmitError(null); }} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={[styles.backButtonText, { color: colors.mutedForeground }]}>Voltar</Text>
          </Pressable>
          <Pressable testID="onboarding-join" onPress={joinWithInvite} disabled={!inviteCode || !guardianName || !consentAccepted || loading}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, flex: 1 }, pressed && styles.pressed, (!inviteCode || !guardianName || !consentAccepted || loading) && { opacity: 0.5 }]}>
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Entrar na família</Text>}
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom + 20, 40), paddingHorizontal: 24, flexGrow: 1 }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Icon name={step === 1 ? 'users' : 'smile'} size={32} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {step === 1 ? 'Bem-vindo ao Família Segura' : 'Quem vamos proteger?'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {step === 1 ? 'Configure o ambiente digital da sua família.' : 'Adicione o perfil da criança que será acompanhada.'}
        </Text>
      </View>
      
      <View style={styles.form}>
        {step === 1 ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Nome da família</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={familyName}
                onChangeText={setFamilyName}
                placeholder="Ex.: Família Andrade"
                placeholderTextColor={colors.mutedForeground}
                testID="onboarding-family-name"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Como você quer ser chamado</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={guardianName}
                onChangeText={setGuardianName}
                placeholder="Seu nome"
                placeholderTextColor={colors.mutedForeground}
                testID="onboarding-guardian-name"
              />
            </View>
            <Pressable onPress={() => setInviteMode(true)} style={({ pressed }) => [styles.inviteLink, pressed && styles.pressed]} testID="onboarding-have-invite">
              <Icon name="user-plus" size={16} color={colors.primary} />
              <Text style={[styles.inviteText, { color: colors.primary }]}>Tenho um convite de outro responsável</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Nome da criança</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={childName}
                onChangeText={(text) => { setChildName(text); setSubmitError(null); }}
                placeholder="Nome"
                placeholderTextColor={colors.mutedForeground}
                testID="onboarding-child-name"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Idade</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={childAge}
                onChangeText={(text) => { setChildAge(text); setSubmitError(null); }}
                placeholder="Idade (anos)"
                keyboardType="numeric"
                placeholderTextColor={colors.mutedForeground}
                testID="onboarding-child-age"
              />
            </View>
            <Pressable
              testID="onboarding-consent"
              onPress={() => { setConsentAccepted((accepted) => !accepted); setSubmitError(null); }}
              style={[styles.consentRow, { borderColor: consentAccepted ? colors.primary : colors.border, backgroundColor: colors.card }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentAccepted }}
            >
              <View style={[styles.checkbox, { borderColor: consentAccepted ? colors.primary : colors.mutedForeground, backgroundColor: consentAccepted ? colors.primary : 'transparent' }]}>
                {consentAccepted && <Icon name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={[styles.consentText, { color: colors.foreground }]}>
                Declaro ser pai, mãe ou responsável legal por esta criança e autorizo, em nome dela, o tratamento dos dados necessários ao controle parental (tempo de uso por app, apps instalados, estado da proteção dos aparelhos), conforme o art. 14 da LGPD e a Política de Privacidade, e aceito os Termos de Uso. Posso exportar ou apagar tudo quando quiser.
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Pressable onPress={() => void openLegal('privacy')} hitSlop={8}>
                <Text style={[styles.inviteText, { color: colors.primary }]}>Política de Privacidade</Text>
              </Pressable>
              <Pressable onPress={() => void openLegal('terms')} hitSlop={8}>
                <Text style={[styles.inviteText, { color: colors.primary }]}>Termos de Uso</Text>
              </Pressable>
            </View>
          </>
        )}

        {submitError && (
          <View style={[styles.errorContainer, { backgroundColor: colors.dangerSoft, borderColor: colors.destructive }]}>
            <Icon name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{submitError}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.footer}>
        {step === 2 && (
          <Pressable 
            onPress={() => { setStep(1); setSubmitError(null); }} 
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            disabled={loading}
          >
            <Text style={[styles.backButtonText, { color: colors.mutedForeground }]}>Voltar</Text>
          </Pressable>
        )}
        <Pressable
          testID="onboarding-next"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, flex: 1 },
            pressed && styles.pressed,
            ((step === 1 && (!familyName || !guardianName)) || (step === 2 && (!childName || !childAge || !consentAccepted)) || loading) && { opacity: 0.5 }
          ]}
          onPress={handleNext}
          disabled={((step === 1 && (!familyName || !guardianName)) || (step === 2 && (!childName || !childAge || !consentAccepted)) || loading)}
        >
          {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{step === 1 ? 'Continuar' : 'Concluir'}</Text>}
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 26, marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: 'NunitoSans_500Medium', fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  form: { flex: 1, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  inputGroup: { gap: 8 },
  label: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  input: { height: 56, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontFamily: 'NunitoSans_500Medium', fontSize: 15 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 4 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  consentText: { flex: 1, fontFamily: 'NunitoSans_500Medium', fontSize: 13, lineHeight: 20 },
  
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, borderWidth: 1 },
  errorText: { flex: 1, fontFamily: 'NunitoSans_600SemiBold', fontSize: 13, lineHeight: 18 },
  
  footer: { flexDirection: 'row', gap: 12, marginTop: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  button: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  backButton: { height: 56, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16 },
  
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  inviteLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  inviteText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
});