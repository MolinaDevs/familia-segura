import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function AppLayout() {
  const { isSignedIn, getToken, isLoaded } = useAuth();
  const colors = useColors();
  
  useEffect(() => {
    setAuthTokenGetter(Platform.OS === 'web' ? null : () => getToken());
  }, [getToken]);

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Verificando sua sessão...</Text>
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar', headerShown: false }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="app/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="subscription" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
