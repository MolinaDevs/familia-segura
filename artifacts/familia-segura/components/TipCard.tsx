import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';

/**
 * Dica de contexto na primeira visita a uma tela. "Entendi" some para sempre (por aparelho).
 * Curta de propósito: uma frase que ensina o gesto principal da tela.
 */
export function TipCard({ id, icon = 'info', title, children }: PropsWithChildren<{ id: string; icon?: IconName; title: string }>) {
  const colors = useColors();
  const key = `tip-${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key).then((seen) => setVisible(!seen)).catch(() => setVisible(false));
  }, [key]);

  if (!visible) return null;
  const dismiss = () => {
    setVisible(false);
    void AsyncStorage.setItem(key, '1').catch(() => undefined);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.sunSoft, borderColor: colors.border }]} accessibilityLiveRegion="polite" testID={`tip-${id}`}>
      <View style={[styles.icon, { backgroundColor: colors.card }]}>
        <Icon name={icon} size={18} color={colors.warning} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{children}</Text>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" style={styles.ok}>
          <Text style={[styles.okText, { color: colors.primary }]}>Entendi</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 14 },
  body: { fontFamily: 'NunitoSans_500Medium', fontSize: 13, lineHeight: 19 },
  ok: { alignSelf: 'flex-start', marginTop: 6, minHeight: 28, justifyContent: 'center' },
  okText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 13 },
});
