import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getGetFamilyOverviewQueryKey, useCreateFamily } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const createFamily = useCreateFamily();
  
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
            consentAccepted
          }
        });
        queryClient.setQueryData(getGetFamilyOverviewQueryKey(), family);
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

  return (
    <KeyboardAwareScrollViewCompat 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom + 20, 40), paddingHorizontal: 24, flexGrow: 1 }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Feather name={step === 1 ? 'users' : 'smile'} size={32} color={colors.primaryForeground} />
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
                placeholder="Ex: Família Silva"
                placeholderTextColor={colors.mutedForeground}
                testID="onboarding-family-name"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Seu nome (Responsável)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={guardianName}
                onChangeText={setGuardianName}
                placeholder="Seu nome"
                placeholderTextColor={colors.mutedForeground}
                testID="onboarding-guardian-name"
              />
            </View>
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
                {consentAccepted && <Feather name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={[styles.consentText, { color: colors.foreground }]}>
                Concordo com a coleta de dados necessária para gerenciar limites, pausas, tempo de uso e permissões de apps. Posso exportar ou apagar os dados quando quiser.
              </Text>
            </Pressable>
          </>
        )}

        {submitError && (
          <View style={[styles.errorContainer, { backgroundColor: `${colors.destructive}15`, borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
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
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  form: { flex: 1, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  inputGroup: { gap: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  input: { height: 56, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontFamily: 'Inter_500Medium', fontSize: 15 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 4 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  consentText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20 },
  
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, borderWidth: 1 },
  errorText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  
  footer: { flexDirection: 'row', gap: 12, marginTop: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  button: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  backButton: { height: 56, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});