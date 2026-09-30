import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Emblem } from '@/components/brand/Logo';
import { useColors } from '@/hooks/useColors';

const DISMISS_KEY = 'house-ad-dismissed-until';
const DISMISS_DAYS = 7;

/**
 * Cartão da casa: aparece no lugar do banner quando o anúncio não carrega ou não há ID configurado.
 * Convida para o Premium sem insistir — fechar esconde por 7 dias.
 */
export function HouseAd() {
  const colors = useColors();
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then((value) => setHidden(Boolean(value && Number(value) > Date.now())))
      .catch(() => setHidden(false));
  }, []);

  if (hidden !== false) return null;
  const dismiss = () => {
    setHidden(true);
    void AsyncStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 3600_000)).catch(() => undefined);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="house-ad">
      <Emblem size={40} />
      <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => router.push('/(app)/subscription')}>
        <Text style={[styles.title, { color: colors.foreground }]}>Sem anúncios no Premium</Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]}>Mais crianças, rotinas ilimitadas e resumo da semana.</Text>
        <Text style={[styles.link, { color: colors.primary }]}>Conhecer o Premium</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar sugestão" hitSlop={12} onPress={dismiss} style={styles.close}>
        <Icon name="x" size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 24 },
  title: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 14 },
  detail: { fontFamily: 'NunitoSans_500Medium', fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  link: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 12.5, marginTop: 4 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});
