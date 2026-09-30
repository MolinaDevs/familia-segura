import { useSignIn, useAuth } from '@clerk/expo';
import { type Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '@/hooks/useColors';
import { SocialButtons } from '@/components/auth/SocialButtons';
import {
  AuthButton, AuthCard, AuthField, AuthHeader, AuthShell, AuthSwitch, DividerLabel, FormMessage, TrustNote,
} from '@/components/auth/AuthKit';
import { goBack } from '@/lib/navigation';
import { clerkErrorMessage, clerkFieldError } from '@/lib/clerkErrors';

export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SecondFactor = 'email' | 'phone' | 'totp';

export default function SignInPage() {
  useWarmUpBrowser();
  const colors = useColors();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isLoaded: isAuthLoaded } = useAuth();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  // Segunda etapa: aparelho novo (Clerk "client trust") ou verificação em duas etapas ligada na conta.
  const [secondFactor, setSecondFactor] = useState<SecondFactor | null>(null);
  const [code, setCode] = useState('');

  const emailInvalid = emailTouched && emailAddress.trim().length > 0 && !EMAIL_RE.test(emailAddress.trim());
  const busy = loading || fetchStatus === 'fetching';
  const canSubmit = EMAIL_RE.test(emailAddress.trim()) && password.length > 0 && !busy;

  const finish = async () => {
    await signIn.finalize({ navigate: () => router.replace('/(app)') });
  };

  /** Escolhe e dispara a segunda etapa que a conta suporta (código por e-mail primeiro: é o que toda conta tem). */
  const startSecondFactor = async () => {
    const strategies = (signIn.supportedSecondFactors ?? []).map((factor) => factor.strategy);
    if (strategies.includes('email_code')) {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) { setLocalError(clerkErrorMessage(error, 'Não foi possível enviar o código.')); return; }
      setSecondFactor('email');
    } else if (strategies.includes('totp')) {
      setSecondFactor('totp');
    } else if (strategies.includes('phone_code')) {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) { setLocalError(clerkErrorMessage(error, 'Não foi possível enviar o código.')); return; }
      setSecondFactor('phone');
    } else {
      setLocalError('Sua conta pede uma verificação que o app ainda não suporta. Entre pelo site para ajustar a segurança da conta.');
    }
  };

  const handleSubmit = async () => {
    if (!isAuthLoaded || !canSubmit) return;
    setLoading(true);
    setLocalError(null);
    setNotice(null);
    try {
      const { error } = await signIn.password({
        emailAddress: emailAddress.trim().toLowerCase(),
        password,
      });
      if (error) {
        setLocalError(clerkErrorMessage(error, 'E-mail ou senha não conferem.'));
        return;
      }
      if (signIn.status === 'complete') await finish();
      else if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') await startSecondFactor();
      else setLocalError('Não foi possível concluir a entrada. Tente de novo.');
    } catch (err: unknown) {
      setLocalError(clerkErrorMessage(err, 'Não foi possível entrar agora. Verifique sua conexão.'));
    } finally {
      setLoading(false);
    }
  };

  const verifySecondFactor = async () => {
    if (!secondFactor || code.length < 6 || busy) return;
    setLoading(true);
    setLocalError(null);
    setNotice(null);
    try {
      const { error } = secondFactor === 'email' ? await signIn.mfa.verifyEmailCode({ code })
        : secondFactor === 'phone' ? await signIn.mfa.verifyPhoneCode({ code })
        : await signIn.mfa.verifyTOTP({ code });
      if (error) { setLocalError(clerkErrorMessage(error, 'Código incorreto. Confira e tente de novo.')); return; }
      if (signIn.status === 'complete') await finish();
      else setLocalError('Não deu para confirmar. Peça um novo código.');
    } catch (err: unknown) {
      setLocalError(clerkErrorMessage(err, 'Código incorreto ou expirado.'));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (busy || !secondFactor || secondFactor === 'totp') return;
    setLoading(true);
    setLocalError(null);
    try {
      const { error } = secondFactor === 'email' ? await signIn.mfa.sendEmailCode() : await signIn.mfa.sendPhoneCode();
      if (error) setLocalError(clerkErrorMessage(error, 'Não foi possível reenviar o código.'));
      else setNotice('Enviamos um novo código.');
    } catch (err: unknown) {
      setLocalError(clerkErrorMessage(err, 'Não foi possível reenviar o código.'));
    } finally {
      setLoading(false);
    }
  };

  if (secondFactor) {
    const where = secondFactor === 'email' ? `Enviamos um código de 6 dígitos para ${emailAddress.trim()}.`
      : secondFactor === 'phone' ? 'Enviamos um código de 6 dígitos por SMS para o seu celular cadastrado.'
      : 'Digite o código de 6 dígitos do seu app autenticador.';
    return (
      <AuthShell onBack={() => { setSecondFactor(null); setCode(''); setLocalError(null); setNotice(null); }} backLabel="Voltar">
        <AuthHeader icon="shield" title="Confirme que é você" subtitle={`Primeira entrada neste aparelho ou conta com verificação em duas etapas. ${where}`} />
        <AuthCard>
          <AuthField
            label="Código de confirmação"
            icon="hash"
            value={code}
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            onChangeText={(text) => { setCode(text.replace(/\D/g, '')); setLocalError(null); }}
            onSubmitEditing={() => void verifySecondFactor()}
            style={styles.code}
            testID="signin-code"
          />
          {notice ? <FormMessage tone="info">{notice}</FormMessage> : null}
          {localError ? <FormMessage tone="error">{localError}</FormMessage> : null}
          <AuthButton label="Confirmar e entrar" onPress={() => void verifySecondFactor()} loading={busy} disabled={code.length < 6} testID="signin-code-submit" />
          {secondFactor !== 'totp' ? (
            <AuthButton label="Reenviar código" variant="quiet" onPress={() => void resendCode()} disabled={busy} testID="signin-code-resend" />
          ) : null}
        </AuthCard>
        <TrustNote />
      </AuthShell>
    );
  }

  return (
    <AuthShell onBack={() => goBack('/')}>
      <AuthHeader
        title="Entre na sua conta"
        subtitle="Veja o dia das crianças, responda pedidos e ajuste os combinados."
      />

      <AuthCard>
        <AuthField
          label="E-mail"
          icon="mail"
          value={emailAddress}
          placeholder="voce@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onChangeText={(text) => { setEmailAddress(text); setLocalError(null); }}
          onBlur={() => setEmailTouched(true)}
          error={emailInvalid ? 'Confira o e-mail: parece faltar algo.' : clerkFieldError(errors.fields.identifier)}
          testID="signin-email"
        />

        <AuthField
          label="Senha"
          icon="lock"
          secure
          value={password}
          placeholder="Sua senha"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onChangeText={(text) => { setPassword(text); setLocalError(null); }}
          onSubmitEditing={() => void handleSubmit()}
          error={clerkFieldError(errors.fields.password)}
          testID="signin-password"
          right={(
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Recuperar senha"
              testID="signin-forgot-password"
              hitSlop={12}
              onPress={() => router.push('/(auth)/forgot-password' as Href)}
            >
              <Text style={[styles.forgot, { color: colors.primary }]}>Esqueci a senha</Text>
            </Pressable>
          )}
        />

        {localError ? <FormMessage tone="error">{localError}</FormMessage> : null}

        <AuthButton label="Entrar" onPress={() => void handleSubmit()} loading={busy} disabled={!canSubmit} testID="signin-button" />

        <DividerLabel>ou continue com</DividerLabel>
        <SocialButtons />
      </AuthCard>

      <AuthSwitch question="Ainda não tem conta?" action="Criar conta grátis" onPress={() => router.replace('/sign-up')} testID="signin-to-signup" />
      <TrustNote />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { fontFamily: 'NunitoSans_700Bold', fontSize: 13.5 },
  code: { fontFamily: 'Montserrat_700Bold', fontSize: 26, letterSpacing: 10 },
});
