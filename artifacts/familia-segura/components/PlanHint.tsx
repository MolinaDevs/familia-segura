import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';

/**
 * Quanto do limite do plano grátis já foi usado ("3 de 5 apps com limite"), com atalho para o Premium.
 * Não aparece no Premium. Fica discreto até chegar perto do limite, para informar sem pressionar.
 */
export function PlanUsage({ plan, used, max, label }: { plan?: 'free' | 'premium'; used: number; max?: number; label: string }) {
  const colors = useColors();
  if (plan !== 'free' || !max) return null;
  const full = used >= max;
  const ratio = Math.min(1, used / max);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${used} de ${max} ${label} no plano grátis. Ver o Premium.`}
      onPress={() => router.push('/(app)/subscription')}
      style={({ pressed }) => [styles.box, { backgroundColor: full ? colors.peachSoft : colors.card, borderColor: full ? colors.orange : colors.border }, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {used} de {max} {label} no plano grátis
        </Text>
        <View style={[styles.track, { backgroundColor: colors.muted }]}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: full ? colors.accent : colors.primary }]} />
        </View>
        <Text style={[styles.detail, { color: full ? colors.accent : colors.mutedForeground }]}>
          {full ? 'Chegou ao limite. No Premium é ilimitado.' : 'Ilimitado no Premium.'}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

/** Selo "Premium" para recursos pagos (ex.: travar a tela). */
export function PremiumBadge() {
  const colors = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.peachSoft }]}>
      <Icon name="star" size={11} color={colors.accent} weight="fill" />
      <Text style={[styles.badgeText, { color: colors.accent }]}>PREMIUM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 12 },
  title: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  detail: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 12.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 10, letterSpacing: 0.8 },
});
