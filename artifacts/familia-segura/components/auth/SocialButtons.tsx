import { FontAwesome } from '@expo/vector-icons';
import { useSSO } from '@clerk/expo/experimental';
import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Provider = 'google' | 'apple';
type SocialStatus = {
  tone: 'neutral' | 'error';
  message: string;
} | null;

interface SocialButtonProps {
  provider: Provider;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}

const redirectUrl = AuthSession.makeRedirectUri({
  scheme: 'familia-segura',
  path: 'oauth-callback',
});

function SocialButton({ provider, onPress, loading, disabled }: SocialButtonProps) {
  const colors = useColors();
  const label = provider === 'google' ? 'Google' : 'Apple';

  return (
    <Pressable
      testID={`social-${provider}`}
      accessibilityRole="button"
      accessibilityLabel={`Continuar com ${label}`}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading ? (
        <View style={styles.buttonContent}>
          <ActivityIndicator color={colors.foreground} />
          <Text style={[styles.buttonText, { color: colors.foreground }]}>Conectando com {label}...</Text>
        </View>
      ) : (
        <View style={styles.buttonContent}>
          <FontAwesome name={provider} size={20} color={colors.foreground} />
          <Text style={[styles.buttonText, { color: colors.foreground }]}>Continuar com {label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function firstClerkError(error: unknown) {
  const value = error as {
    code?: string;
    message?: string;
    errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  };
  return {
    code: value.errors?.[0]?.code ?? value.code ?? '',
    message: value.errors?.[0]?.longMessage ?? value.errors?.[0]?.message ?? value.message ?? '',
  };
}

function isCancellation(code: string, message: string) {
  return /cancel|dismiss|closed/i.test(`${code} ${message}`);
}

function isUnavailable(code: string, message: string) {
  return /not.enabled|not.configured|strategy.*invalid|oauth.*invalid|provider.*unavailable/i.test(`${code} ${message}`);
}

export function SocialButtons() {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const colors = useColors();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [status, setStatus] = useState<SocialStatus>(null);

  const handleSSO = async (provider: Provider) => {
    setStatus(null);
    setLoadingProvider(provider);
    try {
      const result = await startSSOFlow({
        strategy: provider === 'google' ? 'oauth_google' : 'oauth_apple',
        redirectUrl,
      });

      if (result.authSessionResult && result.authSessionResult.type !== 'success') {
        setStatus({ tone: 'neutral', message: 'Entrada cancelada. Nenhuma alteração foi feita.' });
        return;
      }

      if (result.createdSessionId) {
        router.replace('/(app)');
        return;
      }

      const missingRequirements =
        result.signUp?.status === 'missing_requirements'
        || result.signIn?.status === 'needs_first_factor'
        || result.signIn?.status === 'needs_second_factor'
        || result.signIn?.status === 'needs_client_trust';
      setStatus({
        tone: 'error',
        message: missingRequirements
          ? 'Sua conta exige uma etapa adicional que ainda não está disponível neste fluxo.'
          : 'A entrada não foi concluída. Tente novamente.',
      });
    } catch (error: unknown) {
      const { code, message } = firstClerkError(error);
      if (code === 'session_exists') {
        router.replace('/(app)');
      } else if (isCancellation(code, message)) {
        setStatus({ tone: 'neutral', message: 'Entrada cancelada. Nenhuma alteração foi feita.' });
      } else if (isUnavailable(code, message)) {
        setStatus({
          tone: 'error',
          message: `${provider === 'google' ? 'Google' : 'Apple'} ainda não está habilitado neste ambiente.`,
        });
      } else {
        setStatus({ tone: 'error', message: 'Não foi possível conectar. Verifique sua rede e tente novamente.' });
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <SocialButton
        provider="google"
        onPress={() => void handleSSO('google')}
        loading={loadingProvider === 'google'}
        disabled={loadingProvider !== null}
      />
      <SocialButton
        provider="apple"
        onPress={() => void handleSSO('apple')}
        loading={loadingProvider === 'apple'}
        disabled={loadingProvider !== null}
      />
      {status ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.status,
            {
              backgroundColor: status.tone === 'error' ? `${colors.destructive}12` : colors.secondary,
              borderColor: status.tone === 'error' ? `${colors.destructive}40` : colors.border,
            },
          ]}
        >
          <FontAwesome
            name={status.tone === 'error' ? 'exclamation-circle' : 'info-circle'}
            size={14}
            color={status.tone === 'error' ? colors.destructive : colors.secondaryForeground}
          />
          <Text
            style={[
              styles.statusText,
              { color: status.tone === 'error' ? colors.destructive : colors.secondaryForeground },
            ]}
          >
            {status.message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  button: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
  },
  statusText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
});