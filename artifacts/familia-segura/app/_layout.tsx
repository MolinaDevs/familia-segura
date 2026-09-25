import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/context/AppContext';
import { ClerkProvider, ClerkLoaded, ClerkLoading, useAuth } from "@clerk/expo";
import { tokenCache } from "@/utils/cache";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { apiConfigured } from "@/lib/apiConfig";
import "@/services/backgroundSync";
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { reloadAppAsync } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);



const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function StartupScreen({ missingConfiguration = false }: { missingConfiguration?: boolean }) {
  const colors = useColors();
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsDelayed(true), 8_000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16, textAlign: 'center' }}>
        {missingConfiguration ? 'Acesso ainda não configurado' : isDelayed ? 'A conexão está demorando mais que o esperado' : 'Preparando o Família Segura...'}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 320 }}>
        {missingConfiguration
          ? 'A autenticação precisa ser habilitada neste ambiente antes de continuar.'
          : isDelayed
            ? 'Verifique sua conexão. Você pode tentar carregar o aplicativo novamente.'
            : 'Suas informações e preferências estão sendo carregadas com segurança.'}
      </Text>
      {isDelayed && !missingConfiguration ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void reloadAppAsync()}
          style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 12, opacity: pressed ? 0.65 : 1 })}
        >
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SessionQueries({ children }: React.PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function AuthInterceptor({ children }: React.PropsWithChildren) {
  const { getToken, userId } = useAuth();
  const identity = userId ?? 'signed-out';
  const [readyIdentity, setReadyIdentity] = useState<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(Platform.OS === 'web' ? null : () => getToken());
    setReadyIdentity(identity);
  }, [getToken, identity]);

  if (readyIdentity !== identity) return <StartupScreen />;
  return <SessionQueries key={identity}>{children}</SessionQueries>;
}

export default function RootLayout() {
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  // Aparelho da criança não depende do login (Clerk): abre mesmo sem internet e usa a credencial do aparelho.
  const [childMode, setChildMode] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('childMode').then((v) => setChildMode(v === 'true')).catch(() => setChildMode(false));
  }, []);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const timeout = setTimeout(() => setFontWaitExpired(true), 2500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontWaitExpired) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, fontWaitExpired]);

  if ((!fontsLoaded && !fontError && !fontWaitExpired) || childMode === null) return <StartupScreen />;

  const appTree = (
    <SubscriptionProvider>
      <AppProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
              <Stack.Screen name="(child)" options={{ headerShown: false }} />
            </Stack>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </AppProvider>
    </SubscriptionProvider>
  );

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {!publishableKey || !apiConfigured ? (
          <StartupScreen missingConfiguration />
        ) : (
          <ClerkProvider
            telemetry={{ disabled: true }}
            publishableKey={publishableKey}
            tokenCache={tokenCache}
            proxyUrl={proxyUrl}
          >
            {childMode ? (
              <SessionQueries key="child-device">{appTree}</SessionQueries>
            ) : (
              <>
                <ClerkLoading><StartupScreen /></ClerkLoading>
                <ClerkLoaded>
                  <AuthInterceptor>{appTree}</AuthInterceptor>
                </ClerkLoaded>
              </>
            )}
          </ClerkProvider>
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
