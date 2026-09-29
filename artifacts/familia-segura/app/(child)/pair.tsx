import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Alert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { usePairDevice } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

import { goBack } from '@/lib/navigation';
export default function PairDeviceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const pairDevice = usePairDevice();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ready = normalized.length === 8;

  const handlePair = async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const result = await pairDevice.mutateAsync({
        data: {
          code: normalized,
          name: Platform.OS === 'ios' ? 'iPhone' : 'Android',
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          osVersion: String(Platform.Version),
          appVersion: Constants.expoConfig?.version,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
      });
      await AsyncStorage.setItem('childMode', 'true');
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('deviceId', result.device.id);
        await SecureStore.setItemAsync('childId', result.device.childId);
        await SecureStore.setItemAsync('deviceToken', result.deviceToken);
      }
      
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Próximo passo: o responsável conclui a configuração da proteção neste aparelho.
      router.replace('/(child)/guardian');
    } catch (err) {
      const status = (err as { status?: number }).status;
      Alert.alert(
        'Não foi possível vincular',
        status === 409 ? 'A família atingiu o limite de aparelhos. Peça ao responsável para remover um aparelho antigo.'
          : status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.'
          : 'Código inválido ou expirado. Peça um novo código ao responsável.',
      );
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Pressable onPress={() => goBack('/')} style={styles.backButton}>
        <Feather name="x" size={24} color={colors.foreground} />
      </Pressable>

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Feather name="link" size={32} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Vincular Dispositivo</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Peça ao seu responsável para gerar um código no app do responsável e digite-o aqui.
        </Text>
      </View>
      
      <View style={styles.form}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase())}
          placeholder="ABCD-2345"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
        />
        
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            (!ready || loading) && { opacity: 0.5 }
          ]}
          onPress={handlePair}
          disabled={!ready || loading}
        >
          {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Vincular</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backButton: { marginTop: 10, alignSelf: 'flex-start' },
  header: { marginTop: 40, marginBottom: 40, alignItems: 'center' },
  iconContainer: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'Fredoka_600SemiBold', fontSize: 26, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontFamily: 'Nunito_400Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  form: { flex: 1, gap: 16, alignItems: 'center' },
  input: { height: 72, width: '100%', borderWidth: 2, borderRadius: 20, textAlign: 'center', fontFamily: 'Fredoka_600SemiBold', fontSize: 28, letterSpacing: 4 },
  button: { height: 56, width: '100%', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontFamily: 'Nunito_600SemiBold', fontSize: 17 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
