import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

/**
 * Marca do Família Segura: o escudo "squishy" (proteção sem quina) com rosto sereno e um broto
 * (a criança crescendo). Fonte original em assets/brand/mark.svg — manter os dois iguais.
 * `mono` pinta tudo numa cor só (sobre foto ou fundo de cor).
 */
export function BrandMark({ size = 64, mono }: { size?: number; mono?: string }) {
  const colors = useColors();
  const ink = mono ?? colors.markInk;
  const fill = (color: string) => (mono ? 'none' : color);
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" accessibilityRole="image" accessibilityLabel="Família Segura">
      <G fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M 64 22 L 64 31" />
        <Path fill={fill(colors.mint)} d="M 65 23 C 69 13 80 11 85 14 C 82 23 72 27 65 23 Z" />
        <Path
          fill={fill(colors.markBody)}
          d="M 24 33 Q 64 26 104 33 C 109 34 112 37 112 42 L 112 58 C 112 88 93 110 66 121 C 64.7 121.6 63.3 121.6 62 121 C 35 110 16 88 16 58 L 16 42 C 16 37 19 34 24 33 Z"
        />
        {mono ? null : (
          <>
            <Path stroke={colors.markShine} strokeWidth={4.5} opacity={0.9} d="M 27 45 L 27 56" />
            <Ellipse cx={41} cy={87} rx={7.5} ry={4.8} fill={colors.mochi} stroke="none" />
            <Ellipse cx={87} cy={87} rx={7.5} ry={4.8} fill={colors.mochi} stroke="none" />
          </>
        )}
        <Path d="M 44 77 q 7 -9 14 0" />
        <Path d="M 70 77 q 7 -9 14 0" />
        <Path d="M 58 88 q 6 6.5 12 0" />
      </G>
    </Svg>
  );
}

/**
 * O "squish" da marca: achata e cresce (1.03 × 0.97) e assenta, em loop lento.
 * Desligado quando o aparelho pede menos movimento.
 */
export function SquishyMark({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const squish = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(squish, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(squish, { toValue: 0, stiffness: 180, damping: 9, mass: 0.8, useNativeDriver: true }),
        Animated.delay(1600),
      ]));
      loop.start();
    }).catch(() => undefined);
    return () => { cancelled = true; loop?.stop(); };
  }, [squish]);
  const scaleX = squish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const scaleY = squish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  // Achata a partir da base (como um squishy apertado na mesa), não do centro.
  const translateY = squish.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.03] });
  return (
    <Animated.View style={[{ transform: [{ translateY }, { scaleX }, { scaleY }] }, style]}>
      <BrandMark size={size} />
    </Animated.View>
  );
}

/** Assinatura completa: marca + nome em Fredoka. `stacked` empilha (tela de abertura). */
export function Logo({ size = 40, stacked, tagline }: { size?: number; stacked?: boolean; tagline?: boolean }) {
  const colors = useColors();
  return (
    <View style={stacked ? styles.stacked : styles.row} accessible accessibilityRole="header" accessibilityLabel="Família Segura">
      <BrandMark size={size} />
      <View style={stacked ? { alignItems: 'center' } : null}>
        {tagline && !stacked ? <Text style={[styles.tagline, { color: colors.accent }]}>CONTROLE PARENTAL</Text> : null}
        <Text style={[styles.word, { color: colors.foreground, fontSize: stacked ? size * 0.36 : size * 0.52 }]}>Família Segura</Text>
        {tagline && stacked ? <Text style={[styles.tagline, { color: colors.accent, marginTop: 6 }]}>CONTROLE PARENTAL</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stacked: { alignItems: 'center', gap: 14 },
  word: { fontFamily: 'Fredoka_600SemiBold', letterSpacing: -0.4 },
  tagline: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11, letterSpacing: 2.4 },
});
