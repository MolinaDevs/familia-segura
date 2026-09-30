import { Icon } from '@/components/Icon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {action && onPress ? (
        <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <View style={styles.action}>
            <Text style={[styles.actionText, { color: colors.primary }]}>{action}</Text>
            <Icon name="chevron-right" size={15} color={colors.primary} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: 'NunitoSans_700Bold', fontSize: 18, letterSpacing: -0.3 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13 },
  pressed: { opacity: 0.65 },
});