import { Icon } from '@/components/Icon';
import { StyleSheet, Text, View } from 'react-native';
import { AppStatus } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export function StatusPill({ status }: { status: AppStatus }) {
  const colors = useColors();
  const config = {
    permitido: { label: 'Permitido', icon: 'check-circle', color: colors.success, background: colors.successSoft },
    atenção: { label: 'Atenção', icon: 'clock', color: colors.warning, background: colors.warningSoft },
    bloqueado: { label: 'Bloqueado', icon: 'slash', color: colors.destructive, background: colors.dangerSoft },
  }[status];
  return (
    <View style={[styles.pill, { backgroundColor: config.background }]} accessibilityLabel={`Status: ${config.label}`}>
      <Icon name={config.icon as React.ComponentProps<typeof Icon>['name']} size={12} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  label: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 11 },
});
