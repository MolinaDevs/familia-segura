import { Icon, type IconName } from '@/components/Icon';
import { StyleSheet, Text, View } from 'react-native';
import { AppStatus } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export function StatusPill({ status }: { status: AppStatus }) {
  const colors = useColors();
  const config: Record<AppStatus, { label: string; icon: IconName; color: string; background: string }> = {
    permitido: { label: 'Permitido', icon: 'check-circle', color: colors.success, background: colors.successSoft },
    atenção: { label: 'Atenção', icon: 'clock', color: colors.warning, background: colors.warningSoft },
    bloqueado: { label: 'Bloqueado', icon: 'slash', color: colors.destructive, background: colors.dangerSoft },
  };
  const item = config[status];
  return (
    <View style={[styles.pill, { backgroundColor: item.background }]} accessibilityLabel={`Status: ${item.label}`}>
      <Icon name={item.icon} size={12} color={item.color} />
      <Text style={[styles.label, { color: item.color }]}>{item.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  label: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 11 },
});
