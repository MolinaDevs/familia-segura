import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

/** Emblema do logo (escudo, casa e família). Fonte: assets/brand/emblem.png (fundo creme do logo). */
const EMBLEM = require('@/assets/brand/emblem.png');
const EMBLEM_RATIO = 928 / 1024;

/**
 * O emblema tem fundo creme. No tema claro ele se funde ao fundo do app; no escuro fica sobre uma
 * placa creme arredondada, para o azul-marinho do escudo não sumir.
 */
export function Emblem({ size = 64 }: { size?: number }) {
  const colors = useColors();
  const plated = colors.emblemPlate !== 'transparent';
  const image = (
    <Image
      source={EMBLEM}
      style={{ width: size * EMBLEM_RATIO, height: size }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Família Segura"
    />
  );
  if (!plated) return image;
  return (
    <View style={{ backgroundColor: colors.emblemPlate, borderRadius: size * 0.26, padding: size * 0.1 }}>
      {image}
    </View>
  );
}

/**
 * O emblema "respira": sobe um pouco e volta, devagar — presença calma, não alerta.
 * Desligado quando o aparelho pede menos movimento.
 */
export function BreathingEmblem({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
    }).catch(() => undefined);
    return () => { cancelled = true; loop?.stop(); };
  }, [breath]);
  const translateY = breath.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.03] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  return (
    <Animated.View style={[{ transform: [{ translateY }, { scale }] }, style]}>
      <Emblem size={size} />
    </Animated.View>
  );
}

/**
 * Assinatura: emblema + "FAMÍLIA SEGURA" em Montserrat, como no logo.
 * `stacked` empilha (abertura); `tagline` mostra "CONTROLE PARENTAL · IPHONE E ANDROID".
 */
export function Logo({ size = 40, stacked, tagline }: { size?: number; stacked?: boolean; tagline?: boolean }) {
  const colors = useColors();
  const fontSize = stacked ? size * 0.3 : size * 0.38;
  return (
    <View style={stacked ? styles.stacked : styles.row} accessible accessibilityRole="header" accessibilityLabel="Família Segura">
      <Emblem size={size} />
      <View style={stacked ? { alignItems: 'center' } : null}>
        <Text style={[styles.word, { color: colors.navy, fontSize, lineHeight: fontSize * 1.1, textAlign: stacked ? 'center' : 'left' }]}>
          {stacked ? 'FAMÍLIA\nSEGURA' : 'FAMÍLIA SEGURA'}
        </Text>
        {tagline ? (
          <Text style={[styles.tagline, { color: colors.mutedForeground, marginTop: stacked ? 10 : 2 }]}>
            CONTROLE PARENTAL · IPHONE E ANDROID
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stacked: { alignItems: 'center', gap: 16 },
  word: { fontFamily: 'Montserrat_800ExtraBold', letterSpacing: 0.4 },
  tagline: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 10.5, letterSpacing: 1.6 },
});
