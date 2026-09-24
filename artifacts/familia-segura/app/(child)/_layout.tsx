import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export default function ChildLayout() {
  useEffect(() => {
    setAuthTokenGetter(async () => {
      return await SecureStore.getItemAsync('deviceToken');
    });
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="pair" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="ios-controls" options={{ headerShown: false }} />
      <Stack.Screen name="android-controls" options={{ headerShown: false }} />
    </Stack>
  );
}
