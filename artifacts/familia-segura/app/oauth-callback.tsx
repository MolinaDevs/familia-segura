import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function OAuthCallbackScreen() {
  const colors = useColors();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/'), 8_000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.title, { color: colors.foreground }]}>Concluindo acesso seguro...</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        Se esta janela não fechar automaticamente, volte ao Família Segura.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, textAlign: 'center' },
  message: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});