import { useSignUp, useAuth } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SocialButtons } from '@/components/auth/SocialButtons';
import * as WebBrowser from 'expo-web-browser';

export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export default function SignUpPage() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isLoaded: isAuthLoaded } = useAuth();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isAuthLoaded) return;
    setLoading(true);
    setLocalError(null);
    try {
      const { error } = await signUp.password({
        emailAddress,
        password,
      });

      if (error) {
        setLocalError(error.longMessage || error.message || 'Erro ao criar conta.');
        setLoading(false);
        return;
      }

      await signUp.verifications.sendEmailCode();
      setPendingVerification(true);
    } catch (err: unknown) {
      const clerkErrors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
      if (clerkErrors?.length) {
        setLocalError(clerkErrors[0].longMessage || clerkErrors[0].message || 'Ocorreu um erro ao criar a conta.');
      } else {
        setLocalError('Ocorreu um erro ao criar a conta.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isAuthLoaded) return;
    setLoading(true);
    setLocalError(null);
    try {
      await signUp.verifications.verifyEmailCode({ code });

      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: () => router.replace('/(app)'),
        });
      } else {
        setLocalError('Falha ao verificar. Verifique o código e tente novamente.');
      }
    } catch (err: unknown) {
      const clerkErrors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
      if (clerkErrors?.length) {
        setLocalError(clerkErrors[0].longMessage || clerkErrors[0].message || 'Código inválido ou expirado.');
      } else {
        setLocalError('Código inválido ou expirado.');
      }
    } finally {
      setLoading(false);
    }
  };

  const paddingTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const paddingBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  if (pendingVerification) {
    return (
      <KeyboardAwareScrollViewCompat
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: paddingTop + 40, paddingBottom: paddingBottom + 40, paddingHorizontal: 24, flexGrow: 1 }]}
        bottomOffset={20}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
            <Feather name="mail" size={32} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verifique seu e-mail</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enviamos um código de verificação para {emailAddress}.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, styles.codeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={code}
            placeholder="000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            onChangeText={(text) => { setCode(text); setLocalError(null); }}
            maxLength={6}
            testID="signup-code-input"
          />

          {localError && (
            <View style={[styles.errorContainer, { backgroundColor: `${colors.destructive}15`, borderColor: colors.destructive }]}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{localError}</Text>
            </View>
          )}

          <Pressable
            testID="signup-verify-button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
              (!code || loading) && { opacity: 0.5 }
            ]}
            onPress={handleVerify}
            disabled={!code || loading}
          >
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Confirmar conta</Text>}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={async () => {
              setLoading(true);
              setLocalError(null);
              try {
                await signUp.verifications.sendEmailCode();
              } catch {
                setLocalError('Erro ao reenviar o código.');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Reenviar código</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: paddingTop + 40, paddingBottom: paddingBottom + 40, paddingHorizontal: 24, flexGrow: 1 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Feather name="user-plus" size={32} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Crie sua conta</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Inicie o acompanhamento do bem-estar digital da sua família.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            autoCapitalize="none"
            autoComplete="email"
            value={emailAddress}
            placeholder="seu@email.com"
            placeholderTextColor={colors.mutedForeground}
            onChangeText={(text) => { setEmailAddress(text); setLocalError(null); }}
            keyboardType="email-address"
            testID="signup-email"
          />
          {errors.fields.emailAddress ? (
            <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.emailAddress.message}</Text>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Senha</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={password}
            placeholder="Escolha uma senha forte"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoComplete="new-password"
            onChangeText={(text) => { setPassword(text); setLocalError(null); }}
            onSubmitEditing={() => void handleSubmit()}
            returnKeyType="go"
            testID="signup-password"
          />
          {errors.fields.password ? (
            <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.password.message}</Text>
          ) : null}
        </View>

        {localError && (
          <View style={[styles.errorContainer, { backgroundColor: `${colors.destructive}15`, borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{localError}</Text>
          </View>
        )}

        <Pressable
          testID="signup-button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            (!emailAddress || !password || loading || fetchStatus === 'fetching') && { opacity: 0.5 }
          ]}
          onPress={handleSubmit}
          disabled={!emailAddress || !password || loading || fetchStatus === 'fetching'}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Criar conta</Text>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>ou</Text>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <SocialButtons />
        <View nativeID="clerk-captcha" />
      </View>

      <View style={styles.footer}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>Já tem conta?</Text>
        <Link href="/sign-in" asChild>
          <Pressable hitSlop={12}>
            <Text style={[styles.link, { color: colors.primary }]}>Faça login</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 16, textAlign: 'center', maxWidth: 280, lineHeight: 24 },
  
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
  fieldError: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  
  codeInput: {
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 14,
    height: 80,
    fontFamily: 'Inter_700Bold',
  },
  
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  
  secondaryButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  
  divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 16 },
  line: { flex: 1, height: 1 },
  dividerText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 'auto', paddingTop: 40 },
  link: { fontFamily: 'Inter_700Bold' },
  
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});