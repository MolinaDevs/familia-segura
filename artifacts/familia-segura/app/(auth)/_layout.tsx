import { useAuth } from '@/lib/auth';
import { Redirect, Stack } from 'expo-router';
import { BrandLoading } from '@/components/brand/BrandLoading';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <BrandLoading detail="Verificando sua sessão..." />;
  }

  if (isSignedIn) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
