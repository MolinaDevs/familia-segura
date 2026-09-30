import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  AuthButton, AuthCard, AuthField, AuthHeader, AuthShell, FormMessage, TrustNote,
} from '@/components/auth/AuthKit';

import { goBack as navigateBack } from '@/lib/navigation';
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
      navigateBack('/(auth)/sign-in');
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

  const disabled = busy
    || (step === 'email' && !emailAddress.trim())
    || (step === 'code' && code.trim().length < 6)
    || (step === 'password' && !passwordChanged && (!password || !passwordConfirmation));

  return (
    <AuthShell onBack={goBack} backLabel={step === 'email' ? 'Voltar para entrar' : 'Voltar ao início da recuperação'}>
      <AuthHeader icon={step === 'email' ? 'mail' : step === 'code' ? 'key' : 'lock'} title={title} subtitle={subtitle} />

      <AuthCard>
        {step === 'email' ? (
          <AuthField
            label="E-mail da conta"
            icon="mail"
            value={emailAddress}
            onChangeText={(text) => { setEmailAddress(text); clearMessages(); }}
            placeholder="voce@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
            error={errors.fields.identifier?.message}
            testID="forgot-password-email"
          />
        ) : null}

        {step === 'code' ? (
          <AuthField
            label="Código de recuperação"
            icon="hash"
            value={code}
            onChangeText={(text) => { setCode(text.replace(/\D/g, '')); clearMessages(); }}
            placeholder="000000"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => void verifyCode()}
            error={errors.fields.code?.message}
            style={styles.code}
            testID="forgot-password-code"
          />
        ) : null}

        {step === 'password' ? (
          <>
            <AuthField
              label="Nova senha"
              icon="lock"
              secure
              value={password}
              onChangeText={(text) => { setPassword(text); clearMessages(); }}
              placeholder="Pelo menos 8 caracteres"
              autoComplete="new-password"
              textContentType="newPassword"
              error={errors.fields.password?.message}
              testID="forgot-password-new-password"
            />
            <AuthField
              label="Confirmar nova senha"
              icon="lock"
              secure
              value={passwordConfirmation}
              onChangeText={(text) => { setPasswordConfirmation(text); clearMessages(); }}
              placeholder="Digite a senha de novo"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => void submitPassword()}
              error={passwordConfirmation && password !== passwordConfirmation ? 'As senhas ainda não são iguais.' : null}
              testID="forgot-password-confirm-password"
            />
          </>
        ) : null}

        {notice ? <FormMessage tone="info">{notice}</FormMessage> : null}
        {localError ? <FormMessage tone="error">{localError}</FormMessage> : null}

        <AuthButton
          label={step === 'email' ? 'Enviar código' : step === 'code' ? 'Confirmar código' : passwordChanged ? 'Continuar' : 'Alterar senha'}
          onPress={() => void (step === 'email' ? sendCode() : step === 'code' ? verifyCode() : submitPassword())}
          loading={busy}
          disabled={disabled}
          testID="forgot-password-submit"
        />

        {step === 'code' ? (
          <AuthButton label="Reenviar código" variant="quiet" onPress={() => void resendCode()} disabled={busy} testID="forgot-password-resend" />
        ) : null}
      </AuthCard>
      <TrustNote />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: 'Montserrat_700Bold', fontSize: 26, letterSpacing: 10 },
});
