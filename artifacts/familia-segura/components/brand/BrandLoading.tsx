import React, { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { BreathingEmblem } from './Logo';
import { BrandBackground } from './BrandBackground';

/** Barra de progresso indeterminada: um trecho azul deslizando num trilho (no lugar do spinner). */
function SlideBar() {
  const colors = useColors();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
      loop.start();
    }).catch(() => undefined);
    return () => { cancelled = true; loop?.stop(); };
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-64, 160] });
  return (
    <View style={[styles.track, { backgroundColor: colors.border }]} accessibilityRole="progressbar" accessibilityLabel="Carregando">
      <Animated.View style={[styles.thumb, { backgroundColor: colors.primary, transform: [{ translateX }] }]} />
    </View>
  );
}

/**
 * Tela de abertura da marca (depois do splash nativo): emblema que respira, letreiro e carregamento.
 * `title`/`detail` trocam o texto quando a espera demora ou falta configuração; `action` mostra um botão.
 */
export function BrandLoading({ title, detail, action, showProgress = true }: {
  title?: string; detail?: string; action?: ReactNode; showProgress?: boolean;
}) {
  const colors = useColors();
  return (
    <BrandBackground>
      <View style={styles.center}>
        <BreathingEmblem size={150} />
        <Text textBreakStrategy="simple" style={[styles.word, { color: colors.navy }]}>{'FAMÍLIA\nSEGURA'}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} textBreakStrategy="simple" style={[styles.tagline, { color: colors.mutedForeground }]}>
          CONTROLE PARENTAL · IPHONE E ANDROID
        </Text>
        <View style={styles.status}>
          {showProgress ? <SlideBar /> : null}
          {title ? <Text accessibilityLiveRegion="polite" style={[styles.title, { color: colors.foreground }]}>{title}</Text> : null}
          {detail ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
          {action}
        </View>
      </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  // Largura do pai (não a medida do texto): no Android a medida com espaçamento entre letras sai curta (lib/text.ts).
  word: { alignSelf: 'stretch', fontFamily: 'Montserrat_800ExtraBold', fontSize: 30, lineHeight: 33, letterSpacing: 0.6, textAlign: 'center', marginTop: 20 },
  tagline: { alignSelf: 'stretch', textAlign: 'center', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 11, letterSpacing: 1.8, marginTop: 10 },
  status: { alignItems: 'center', gap: 10, marginTop: 36, minHeight: 90, maxWidth: 320 },
  track: { width: 160, height: 6, borderRadius: 3, overflow: 'hidden' },
  thumb: { width: 64, height: 6, borderRadius: 3 },
  title: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, textAlign: 'center', marginTop: 6 },
  detail: { fontFamily: 'NunitoSans_500Medium', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
