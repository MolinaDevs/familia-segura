import { useAuth } from '@/lib/auth';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useColors();

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Verificando sua sessão...</Text>
      </View>
    );
  }

  if (isSignedIn) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});