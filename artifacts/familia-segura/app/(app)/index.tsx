import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { getGetFamilyOverviewQueryKey, useGetFamilyOverview } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { BrandLoading } from '@/components/brand/BrandLoading';

export default function AppGateway() {
  const colors = useColors();
  const { data, isLoading, error, refetch, isFetching } = useGetFamilyOverview({
    query: { queryKey: getGetFamilyOverviewQueryKey(), staleTime: 30_000, retry: 1 },
  });

  if (isLoading) {
    return <BrandLoading detail="Carregando sua família..." />;
  }

  const errorStatus = (error as { status?: number } | null)?.status;

  if (errorStatus === 404) {
    return <Redirect href="/(app)/onboarding" />;
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Não foi possível carregar sua família</Text>
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          Verifique sua conexão. Nenhuma configuração foi alterada.
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
  title: { fontFamily: 'Fredoka_600SemiBold', fontSize: 21, textAlign: 'center' },
  message: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  retry: { height: 48, minWidth: 180, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  retryText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.72 },
});
