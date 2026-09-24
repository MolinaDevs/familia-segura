import { useSignIn, useAuth } from '@clerk/expo';
import { type Href, Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SocialButtons } from '@/components/auth/SocialButtons';

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

export default function SignInPage() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isLoaded: isAuthLoaded } = useAuth();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isAuthLoaded) return;
    setLoading(true);
    setLocalError(null);
    try {
      const { error } = await signIn.password({
        emailAddress,
        password,
      });
      if (error) {
        setLocalError(error.longMessage || error.message || 'Credenciais inválidas.');
        return;
      }
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: () => router.replace('/(app)'),
        });
      } else {
        setLocalError('Configuração adicional necessária (MFA).');
      }
    } catch (err: unknown) {
      const clerkErrors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
      if (clerkErrors?.length) {
        setLocalError(clerkErrors[0].longMessage || clerkErrors[0].message || 'Ocorreu um erro ao entrar.');
      } else {
        setLocalError('Ocorreu um erro ao entrar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const paddingTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const paddingBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: paddingTop + 40, paddingBottom: paddingBottom + 40, paddingHorizontal: 24, flexGrow: 1 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Feather name="log-in" size={32} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Acesse sua conta</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Bem-vindo de volta ao Família Segura.
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
            testID="signin-email"
          />
          {errors.fields.identifier ? (
            <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.identifier.message}</Text>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.passwordHeader}>
            <Text style={[styles.label, { color: colors.foreground }]}>Senha</Text>
            <Link href={'/(auth)/forgot-password' as Href} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Recuperar senha"
                testID="signin-forgot-password"
                hitSlop={12}
              >
                <Text style={[styles.forgotPassword, { color: colors.primary }]}>Esqueci minha senha</Text>
              </Pressable>
            </Link>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={password}
            placeholder="Sua senha"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoComplete="current-password"
            onChangeText={(text) => { setPassword(text); setLocalError(null); }}
            onSubmitEditing={() => void handleSubmit()}
            returnKeyType="go"
            testID="signin-password"
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
          testID="signin-button"
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
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Entrar</Text>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>ou</Text>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <SocialButtons />
      </View>

      <View style={styles.footer}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>Ainda não tem conta?</Text>
        <Link href="/sign-up" asChild>
          <Pressable hitSlop={12}>
            <Text style={[styles.link, { color: colors.primary }]}>Criar agora</Text>
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
  passwordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  forgotPassword: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  fieldError: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  
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