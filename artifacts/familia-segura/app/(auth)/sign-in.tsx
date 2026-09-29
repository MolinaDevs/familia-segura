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
  const [emailTouched, setEmailTouched] = useState(false);

  const emailInvalid = emailTouched && emailAddress.trim().length > 0 && !EMAIL_RE.test(emailAddress.trim());
  const busy = loading || fetchStatus === 'fetching';
  const canSubmit = EMAIL_RE.test(emailAddress.trim()) && password.length > 0 && !busy;

  const handleSubmit = async () => {
    if (!isAuthLoaded || !canSubmit) return;
    setLoading(true);
    setLocalError(null);
    try {
      const { error } = await signIn.password({
        emailAddress: emailAddress.trim(),
        password,
      });
      if (error) {
        setLocalError(error.longMessage || error.message || 'E-mail ou senha não conferem.');
        return;
      }
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: () => router.replace('/(app)'),
        });
      } else {
        setLocalError('Sua conta pede uma verificação extra (duas etapas), que ainda não está disponível no app.');
      }
    } catch (err: unknown) {
      const clerkErrors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
      if (clerkErrors?.length) {
        setLocalError(clerkErrors[0].longMessage || clerkErrors[0].message || 'Não foi possível entrar agora.');
      } else {
        setLocalError('Não foi possível entrar agora. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell onBack={() => goBack('/')}>
      <AuthHeader
        title="Que bom ter você de volta"
        subtitle="Entre para ver o dia das crianças, responder pedidos e ajustar os combinados."
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
          error={emailInvalid ? 'Confira o e-mail: parece faltar algo.' : errors.fields.identifier?.message}
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
          error={errors.fields.password?.message}
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
  forgot: { fontFamily: 'Nunito_700Bold', fontSize: 13.5 },
});
