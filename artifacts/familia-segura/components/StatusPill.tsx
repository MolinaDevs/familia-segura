import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppStatus } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export function StatusPill({ status }: { status: AppStatus }) {
  const colors = useColors();
  const config = {
    permitido: { label: 'Permitido', icon: 'check-circle', color: '#3b9b69', background: '#e5f4eb' },
    atenção: { label: 'Atenção', icon: 'clock', color: '#b57c1b', background: '#fff3d4' },
    bloqueado: { label: 'Bloqueado', icon: 'slash', color: colors.destructive, background: '#fde8e5' },
  }[status];
  return (
    <View style={[styles.pill, { backgroundColor: config.background }]}>
      <Feather name={config.icon as keyof typeof Feather.glyphMap} size={12} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});