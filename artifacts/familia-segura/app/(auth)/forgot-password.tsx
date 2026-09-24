import { useSignIn } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

type Step = 'email' | 'code' | 'password';

function errorMessage(error: unknown, fallback: string) {
  const value = error as {
    code?: string;
    message?: string;
    longMessage?: string;
    errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  };
  const code = value.errors?.[0]?.code ?? value.code;
  if (code === 'form_code_expired') return 'Este código expirou. Solicite um novo código para continuar.';
  if (code === 'form_code_incorrect') return 'O código informado está incorreto.';
  if (code === 'form_identifier_not_found') return 'Não encontramos uma conta com este e-mail.';
  return value.errors?.[0]?.longMessage
    ?? value.errors?.[0]?.message
    ?? value.longMessage
    ?? value.message
    ?? fallback;
}

export default function ForgotPasswordPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('email');
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const busy = loading || fetchStatus === 'fetching';
  const paddingTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const paddingBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const clearMessages = () => {
    setLocalError(null);
    setNotice(null);
  };

  const sendCode = async () => {
    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (!normalizedEmail || busy) return;
    setLoading(true);
    clearMessages();
    try {
      const { error: createError } = await signIn.create({ identifier: normalizedEmail });
      if (createError) {
        setLocalError(createError.longMessage || createError.message || 'Não foi possível localizar esta conta.');
        return;
      }
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) {
        setLocalError(sendError.longMessage || sendError.message || 'Não foi possível enviar o código.');
        return;
      }
      setEmailAddress(normalizedEmail);
      setStep('code');
      setNotice(`Enviamos um código para ${normalizedEmail}.`);
    } catch (error: unknown) {
      setLocalError(errorMessage(error, 'Não foi possível enviar o código. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim() || busy) return;
    setLoading(true);
    clearMessages();
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (error) {
        setLocalError(error.longMessage || error.message || 'Código inválido ou expirado.');
        return;
      }
      if (signIn.status !== 'needs_new_password') {
        setLocalError('Não foi possível confirmar o código. Solicite um novo código e tente novamente.');
        return;
      }
      setStep('password');
    } catch (error: unknown) {
      setLocalError(errorMessage(error, 'Código inválido ou expirado.'));
    } finally {
      setLoading(false);
    }
  };

  const finalizeSession = async () => {
    const { error } = await signIn.finalize({
      navigate: () => router.replace('/(app)'),
    });
    if (error) {
      setLocalError(
        error.longMessage
        || error.message
        || 'Sua senha foi alterada, mas não foi possível abrir sua conta. Tente continuar novamente.',
      );
      return false;
    }
    return true;
  };

  const submitPassword = async () => {
    if (busy) return;
    let passwordWasChanged = passwordChanged;
    setLoading(true);
    clearMessages();
    try {
      if (!passwordChanged) {
        if (!password || !passwordConfirmation) return;
        if (password !== passwordConfirmation) {
          setLocalError('As senhas não coincidem.');
          return;
        }
        const { error } = await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });
        if (error) {
          setLocalError(error.longMessage || error.message || 'Não foi possível alterar a senha.');
          return;
        }
        if (signIn.status !== 'complete') {
          setLocalError('A senha foi alterada, mas sua sessão exige uma verificação adicional.');
          return;
        }
        setPasswordChanged(true);
        passwordWasChanged = true;
      }
      await finalizeSession();
    } catch (error: unknown) {
      setLocalError(errorMessage(
        error,
        passwordWasChanged
          ? 'Sua senha foi alterada, mas não foi possível abrir sua conta. Tente continuar novamente.'
          : 'Não foi possível alterar a senha. Tente novamente.',
      ));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (busy) return;
    setLoading(true);
    clearMessages();
    try {
      const { error } = await signIn.resetPasswordEmailCode.sendCode();
      if (error) {
        setLocalError(error.longMessage || error.message || 'Não foi possível reenviar o código.');
        return;
      }
      setNotice('Um novo código foi enviado.');
    } catch (error: unknown) {
      setLocalError(errorMessage(error, 'Não foi possível reenviar o código.'));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'email') {
      router.back();
      return;
    }
    void signIn.reset();
    setStep('email');
    setCode('');
    setPassword('');
    setPasswordConfirmation('');
    setPasswordChanged(false);
    clearMessages();
  };

  const title = step === 'email'
    ? 'Recupere sua senha'
    : step === 'code'
      ? 'Confirme o código'
      : 'Crie uma nova senha';
  const subtitle = step === 'email'
    ? 'Informe o e-mail da sua conta para receber um código de recuperação.'
    : step === 'code'
      ? `Digite o código enviado para ${emailAddress}.`
      : 'Use uma senha segura que você ainda não utiliza em outros serviços.';

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: paddingTop + 32, paddingBottom: paddingBottom + 40, paddingHorizontal: 24, flexGrow: 1 },
      ]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={step === 'email' ? 'Voltar para entrar' : 'Voltar ao início da recuperação'}
        onPress={goBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        testID="forgot-password-back"
        hitSlop={12}
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Voltar</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Feather
            name={step === 'email' ? 'mail' : step === 'code' ? 'key' : 'lock'}
            size={32}
            color={colors.primaryForeground}
          />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>

      <View style={styles.form}>
        {step === 'email' ? (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
            <TextInput
              value={emailAddress}
              onChangeText={(text) => { setEmailAddress(text); clearMessages(); }}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="seu@email.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={() => void sendCode()}
              accessibilityLabel="E-mail da conta"
              testID="forgot-password-email"
            />
            {errors.fields.identifier ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.identifier.message}</Text>
            ) : null}
          </View>
        ) : null}

        {step === 'code' ? (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Código de recuperação</Text>
            <TextInput
              value={code}
              onChangeText={(text) => { setCode(text); clearMessages(); }}
              style={[
                styles.input,
                styles.codeInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={() => void verifyCode()}
              accessibilityLabel="Código de recuperação"
              testID="forgot-password-code"
            />
            {errors.fields.code ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.code.message}</Text>
            ) : null}
          </View>
        ) : null}

        {step === 'password' ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Nova senha</Text>
              <TextInput
                value={password}
                onChangeText={(text) => { setPassword(text); clearMessages(); }}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Sua nova senha"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoComplete="new-password"
                accessibilityLabel="Nova senha"
                testID="forgot-password-new-password"
              />
              {errors.fields.password ? (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.password.message}</Text>
              ) : null}
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Confirmar nova senha</Text>
              <TextInput
                value={passwordConfirmation}
                onChangeText={(text) => { setPasswordConfirmation(text); clearMessages(); }}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Digite a senha novamente"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={() => void submitPassword()}
                accessibilityLabel="Confirmar nova senha"
                testID="forgot-password-confirm-password"
              />
            </View>
          </>
        ) : null}

        {notice ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.messageBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Feather name="check-circle" size={16} color={colors.secondaryForeground} />
            <Text style={[styles.messageText, { color: colors.secondaryForeground }]}>{notice}</Text>
          </View>
        ) : null}

        {localError ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.messageBox, { backgroundColor: `${colors.destructive}15`, borderColor: colors.destructive }]}
          >
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.messageText, { color: colors.destructive }]}>{localError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={step === 'email' ? sendCode : step === 'code' ? verifyCode : submitPassword}
          disabled={
            busy
            || (step === 'email' && !emailAddress.trim())
            || (step === 'code' && !code.trim())
            || (step === 'password' && !passwordChanged && (!password || !passwordConfirmation))
          }
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            (busy
              || (step === 'email' && !emailAddress.trim())
              || (step === 'code' && !code.trim())
              || (step === 'password' && !passwordChanged && (!password || !passwordConfirmation))) && styles.disabled,
          ]}
          testID="forgot-password-submit"
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {step === 'email'
                ? 'Enviar código'
                : step === 'code'
                  ? 'Confirmar código'
                  : passwordChanged
                    ? 'Continuar'
                    : 'Alterar senha'}
            </Text>
          )}
        </Pressable>

        {step === 'code' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void resendCode()}
            disabled={busy}
            style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed, busy && styles.disabled]}
            testID="forgot-password-resend"
            hitSlop={12}
          >
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>Reenviar código</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  
  header: { alignItems: 'center', marginTop: 24, marginBottom: 40 },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, marginBottom: 8, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 16, textAlign: 'center', maxWidth: 340, lineHeight: 24 },
  
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  codeInput: { textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: 14, height: 80 },
  fieldError: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  messageText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  
  primaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  
  secondaryAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});