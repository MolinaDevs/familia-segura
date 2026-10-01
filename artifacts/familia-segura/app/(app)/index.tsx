import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { getGetFamilyOverviewQueryKey, useGetFamilyOverview } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { BrandLoading } from '@/components/brand/BrandLoading';
import { useAuth } from '@/lib/auth';
import { signOutCompletely } from '@/lib/session';

export default function AppGateway() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { data, isPending, error, refetch, isFetching } = useGetFamilyOverview({
    query: { queryKey: getGetFamilyOverviewQueryKey(), staleTime: 30_000 },
  });

  // isPending (e não isLoading): pedido em pausa — sem foco/sem rede no meio das tentativas — ainda é "carregando".
  // Sem isso, a pausa parecia "sem família" e a pessoa caía no cadastro inicial.
  if (isPending) {
    return <BrandLoading detail="Carregando sua família..." />;
  }

  const errorStatus = (error as { status?: number } | null)?.status;

  if (errorStatus === 404) {
    return <Redirect href="/(app)/onboarding" />;
  }

  // 401/403 com a pessoa logada: o servidor não aceitou a sessão (não é falta de internet).
  const sessionRejected = errorStatus === 401 || errorStatus === 403;

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {sessionRejected ? 'Sua sessão não foi reconhecida' : 'Não foi possível carregar sua família'}
        </Text>
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          {sessionRejected
            ? 'Entre de novo para continuar. Nenhuma configuração foi alterada.'
            : 'Verifique sua conexão. Nenhuma configuração foi alterada.'}
        </Text>
        <Pressable
          testID="gateway-retry"
          disabled={isFetching}
          onPress={() => void refetch()}
          style={({ pressed }) => [styles.retry, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          {isFetching ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Tentar novamente</Text>
          )}
        </Pressable>
        {sessionRejected ? (
          <Pressable testID="gateway-sign-out" accessibilityRole="button" hitSlop={10} onPress={() => void signOutCompletely(signOut)}>
            <Text style={[styles.signOut, { color: colors.primary }]}>Sair e entrar de novo</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!data) {
    return <Redirect href="/(app)/onboarding" />;
  }

  return <Redirect href="/(app)/(tabs)" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 21, textAlign: 'center' },
  message: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  retry: { height: 48, minWidth: 180, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  retryText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.72 },
  signOut: { fontFamily: 'NunitoSans_700Bold', fontSize: 14, paddingVertical: 10 },
});
