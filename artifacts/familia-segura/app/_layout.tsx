import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/queryClient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito-sans';
import { Montserrat_600SemiBold, Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/context/AppContext';
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/expo";
import { DEV_AUTH, useAuth } from "@/lib/auth";
import { tokenCache } from "@/utils/cache";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { apiConfigured } from "@/lib/apiConfig";
import "@/services/backgroundSync";
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { reloadAppAsync } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { BrandLoading } from '@/components/brand/BrandLoading';
import { signOutCompletely } from '@/lib/session';
import { setMonitoringMode, withMonitoring } from '@/lib/monitoring';

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

  if (missingConfiguration) {
    return (
      <BrandLoading
        showProgress={false}
        title="Acesso ainda não configurado"
        detail="A autenticação precisa ser habilitada neste ambiente antes de continuar."
      />
    );
  }
  return (
    <BrandLoading
      title={isDelayed ? 'A conexão está demorando mais que o esperado' : undefined}
      detail={isDelayed ? 'Verifique sua internet. Você pode tentar carregar de novo.' : undefined}
      action={isDelayed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void reloadAppAsync()}
          style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 12, opacity: pressed ? 0.65 : 1 })}
        >
          <Text style={{ color: colors.primary, fontFamily: 'NunitoSans_800ExtraBold', fontSize: 15 }}>Tentar novamente</Text>
        </Pressable>
      ) : undefined}
    />
  );
}

/**
 * Aparelho da criança não guarda a conta do responsável (quem pareou estando logado): na abertura em modo
 * criança a sessão é encerrada e o aparelho para de receber os avisos da família. Aqui não há troca de árvore
 * por identidade, então sair não reinicia a navegação.
 */
function ChildSessionCleanup() {
  const { isLoaded, isSignedIn, signOut, getToken } = useAuth();
  useEffect(() => {
    if (!isLoaded || !isSignedIn || DEV_AUTH) return;
    void getToken()
      .then((token) => signOutCompletely(signOut, token))
      .catch(() => undefined);
  }, [isLoaded, isSignedIn, signOut, getToken]);
  return null;
}

function SessionQueries({ children }: React.PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function AuthInterceptor({ children }: React.PropsWithChildren) {
  const { getToken, userId } = useAuth();
  const identity = userId ?? 'signed-out';
  const [readyIdentity, setReadyIdentity] = useState<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(Platform.OS === 'web' && !DEV_AUTH ? null : () => getToken());
    setReadyIdentity(identity);
  }, [getToken, identity]);

  if (readyIdentity !== identity) return <StartupScreen />;
  return <SessionQueries key={identity}>{children}</SessionQueries>;
}

function RootLayout() {
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  // Aparelho da criança não depende do login (Clerk): abre mesmo sem internet e usa a credencial do aparelho.
  const [childMode, setChildMode] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('childMode')
      .then((v) => { setChildMode(v === 'true'); setMonitoringMode(v === 'true' ? 'child' : 'guardian'); })
      .catch(() => setChildMode(false));
  }, []);
  // Tipografia da marca: Nunito Sans no texto, Montserrat nos títulos (o letreiro do logo) — docs/DESIGN.md.
  const [fontsLoaded, fontError] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
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
        {DEV_AUTH ? (
          // Modo demonstração (só desenvolvimento): sem Clerk.
          <AuthInterceptor>{appTree}</AuthInterceptor>
        ) : !publishableKey || !apiConfigured ? (
          <StartupScreen missingConfiguration />
        ) : (
          <ClerkProvider
            telemetry={{ disabled: true }}
            publishableKey={publishableKey}
            tokenCache={tokenCache}
            proxyUrl={proxyUrl}
          >
            {childMode ? (
              <SessionQueries key="child-device">
                <ChildSessionCleanup />
                {appTree}
              </SessionQueries>
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

export default withMonitoring(RootLayout);
