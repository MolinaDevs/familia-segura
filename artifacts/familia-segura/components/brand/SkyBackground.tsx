import { LinearGradient } from 'expo-linear-gradient';
import React, { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

/**
 * Fundo da marca: verde de bebê do topo até 62% e o lilás só no pé.
 * O verde é o tom da casa; o lilás é nuance, não segunda cor (docs/DESIGN.md).
 */
export function SkyBackground({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useColors();
  return (
    <View style={[styles.fill, { backgroundColor: colors.skyMid }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.skyTop, colors.skyMid, colors.skyBottom]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
