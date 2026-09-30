import { useSignUp, useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Força da senha em 3 níveis, só para orientar (a regra de verdade é a do Clerk). */
function passwordStrength(value: string): 0 | 1 | 2 | 3 {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score++;
  return Math.max(1, score) as 1 | 2 | 3;
}
const STRENGTH_LABEL = ['', 'Fraca', 'Boa', 'Forte'];

function StrengthMeter({ value }: { value: string }) {
  const colors = useColors();
  const level = passwordStrength(value);
  if (!level) return null;
  const tint = level === 1 ? colors.destructive : level === 2 ? colors.warning : colors.success;
  return (
    <View style={styles.strength} accessibilityLabel={`Força da senha: ${STRENGTH_LABEL[level]}`}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={[styles.strengthBar, { backgroundColor: step <= level ? tint : colors.border }]} />
      ))}
      <Text style={[styles.strengthText, { color: tint }]}>{STRENGTH_LABEL[level]}</Text>
    </View>
  );
}

export default function SignUpPage() {
  useWarmUpBrowser();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isLoaded: isAuthLoaded } = useAuth();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const busy = loading || fetchStatus === 'fetching';
  const emailOk = EMAIL_RE.test(emailAddress.trim());
  const emailInvalid = emailTouched && emailAddress.trim().length > 0 && !emailOk;
  // Mesmo mínimo do Clerk: a pessoa descobre antes de enviar, não depois.
  const passwordOk = password.length >= 8;
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async () => {
    if (!isAuthLoaded || !emailOk || !passwordOk || busy) return;
    setLoading(true);
    setLocalError(null);
    try {
      const { error } = await signUp.password({
        emailAddress: emailAddress.trim().toLowerCase(),
        password,
      });

      if (error) {
        setLocalError(clerkErrorMessage(error, 'Não foi possível criar a conta.'));
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setLocalError(clerkErrorMessage(sendError, 'Não foi possível enviar o código de confirmação.'));
        return;
      }
      setPendingVerification(true);
      setCooldown(30);
    } catch (err: unknown) {
      setLocalError(clerkErrorMessage(err, 'Não foi possível criar a conta. Verifique sua conexão.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isAuthLoaded || !code || busy) return;
    setLoading(true);
    setLocalError(null);
    setNotice(null);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) {
        setLocalError(clerkErrorMessage(error, 'Código inválido ou expirado.'));
        return;
      }

      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: () => router.replace('/(app)'),
        });
      } else {
        setLocalError('Não deu para confirmar. Confira o código e tente de novo.');
      }
    } catch (err: unknown) {
      setLocalError(clerkErrorMessage(err, 'Código inválido ou expirado.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (busy || cooldown > 0) return;
    setLoading(true);
    setLocalError(null);
    setNotice(null);
    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) { setLocalError(clerkErrorMessage(error, 'Não foi possível reenviar o código.')); return; }
      setNotice('Enviamos um novo código.');
      setCooldown(30);
    } catch (err: unknown) {
      setLocalError(clerkErrorMessage(err, 'Não foi possível reenviar o código.'));
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <AuthShell onBack={() => { setPendingVerification(false); setCode(''); setLocalError(null); }} backLabel="Corrigir e-mail">
        <AuthHeader icon="mail" title="Confira seu e-mail" subtitle={`Enviamos um código de 6 dígitos para ${emailAddress.trim()}.`} />
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
            onSubmitEditing={() => void handleVerify()}
            style={styles.code}
            testID="signup-code-input"
          />
          {notice ? <FormMessage tone="info">{notice}</FormMessage> : null}
          {localError ? <FormMessage tone="error">{localError}</FormMessage> : null}
          <AuthButton label="Confirmar conta" onPress={() => void handleVerify()} loading={busy} disabled={code.length < 6} testID="signup-verify-button" />
          <AuthButton label={cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'} variant="quiet" onPress={() => void resend()} disabled={busy || cooldown > 0} testID="signup-resend" />
        </AuthCard>
        <TrustNote />
      </AuthShell>
    );
  }

  return (
    <AuthShell onBack={() => goBack('/')}>
      <AuthHeader
        title="Crie a conta da família"
        subtitle="Leva um minuto. Depois você cadastra as crianças e pareia os aparelhos delas."
      />

      <AuthCard>
        <AuthField
          label="E-mail do responsável"
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
          error={emailInvalid ? 'Confira o e-mail: parece faltar algo.' : clerkFieldError(errors.fields.emailAddress)}
          testID="signup-email"
        />

        <View>
          <AuthField
            label="Senha"
            icon="lock"
            secure
            value={password}
            placeholder="Pelo menos 8 caracteres"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onChangeText={(text) => { setPassword(text); setLocalError(null); }}
            onSubmitEditing={() => void handleSubmit()}
            error={password.length > 0 && !passwordOk ? 'Use pelo menos 8 caracteres.' : clerkFieldError(errors.fields.password)}
            helper="Misture letras, números e símbolos."
            testID="signup-password"
          />
          <StrengthMeter value={password} />
        </View>

        {localError ? <FormMessage tone="error">{localError}</FormMessage> : null}

        <AuthButton label="Criar conta" onPress={() => void handleSubmit()} loading={busy} disabled={!emailOk || !passwordOk} testID="signup-button" />

        <DividerLabel>ou continue com</DividerLabel>
        <SocialButtons />
        <View nativeID="clerk-captcha" />
      </AuthCard>

      <AuthSwitch question="Já tem conta?" action="Entrar" onPress={() => router.replace('/sign-in')} testID="signup-to-signin" />
      <TrustNote />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: 'Montserrat_700Bold', fontSize: 26, letterSpacing: 10 },
  strength: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  strengthBar: { flex: 1, height: 5, borderRadius: 3 },
  strengthText: { fontFamily: 'NunitoSans_700Bold', fontSize: 12, minWidth: 44, textAlign: 'right' },
});
