import { LinearGradient } from 'expo-linear-gradient';
import React, { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

/**
 * Fundo da marca: o creme do logo, com um sopro de azul só no pé (docs/DESIGN.md).
 * O creme é a casa; o azul é nuance, não segunda cor.
 */
export function BrandBackground({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useColors();
  return (
    <View style={[styles.fill, { backgroundColor: colors.bgMid }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.bgTop, colors.bgMid, colors.bgBottom]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
