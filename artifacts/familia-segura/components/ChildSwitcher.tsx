import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { textOn } from '@/lib/contrast';

/**
 * Seletor de criança no topo das telas (até 10 crianças).
 * `allowAll` adiciona a opção "Todos" (usada nos relatórios); o valor null representa "Todos".
 */
export function ChildSwitcher({ value, onChange, allowAll }: { value?: string | null; onChange?: (childId: string | null) => void; allowAll?: boolean }) {
  const colors = useColors();
  const { data, selectChild, canEdit } = useFamily();
  const selected = value === undefined ? data.childId : value;
  const pick = (id: string | null) => {
    if (onChange) onChange(id);
    else if (id) selectChild(id);
  };
  if (data.children.length <= 1 && !allowAll) return null;
  const canAdd = canEdit && data.limits && data.limits.children < data.limits.maxChildren;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {allowAll && (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === null }} onPress={() => pick(null)}
          style={[styles.chip, { borderColor: selected === null ? colors.primary : colors.border, backgroundColor: selected === null ? colors.secondary : colors.card }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Icon name="users" size={13} color={colors.primaryForeground} /></View>
          <Text style={[styles.label, { color: colors.foreground }]}>Todos</Text>
        </Pressable>
      )}
      {data.children.map((child) => {
        const active = child.id === selected;
        return (
          <Pressable key={child.id} testID={`child-switch-${child.id}`} accessibilityRole="button" accessibilityState={{ selected: active }}
            accessibilityLabel={`Ver ${child.displayName}`} onPress={() => pick(child.id)}
            style={[styles.chip, { borderColor: active ? child.color : colors.border, backgroundColor: active ? colors.secondary : colors.card }]}>
            <View style={[styles.avatar, { backgroundColor: child.color }]}>
              <Text style={[styles.initial, { color: textOn(child.color) }]}>{child.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>{child.displayName}</Text>
          </Pressable>
        );
      })}
      {canAdd && (
        <Pressable accessibilityRole="button" accessibilityLabel="Adicionar criança" onPress={() => router.push('/(app)/child-edit')}
          style={[styles.chip, styles.add, { borderColor: colors.border }]}>
          <Icon name="plus" size={16} color={colors.primary} />
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -20, marginBottom: 18, flexGrow: 0 },
  row: { paddingHorizontal: 20, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 99, paddingLeft: 5, paddingRight: 14, paddingVertical: 5, minHeight: 44 },
  add: { paddingHorizontal: 12, borderStyle: 'dashed' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'NunitoSans_700Bold', fontSize: 13 },
  label: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
});
