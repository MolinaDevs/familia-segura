import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RoutineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, toggleRoutine } = useFamily();

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16, paddingBottom: Platform.OS === 'web' ? 118 : insets.bottom + 100 }]}>
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PAUSAS E ROTINAS</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Equilíbrio digital</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>O Família Segura bloqueia distrações em momentos chave do dia a dia.</Text>

      <View style={[styles.tip, { backgroundColor: colors.secondary }]}>
        <View style={[styles.tipIcon, { backgroundColor: colors.card }]}>
          <Feather name="heart" size={20} color={colors.primary} />
        </View>
        <View style={styles.tipCopy}>
          <Text style={[styles.tipTitle, { color: colors.secondaryForeground }]}>Dica de convivência</Text>
          <Text style={[styles.tipText, { color: colors.secondaryForeground }]}>Acorde as regras junto com a criança para construir confiança.</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Horários</Text>
      {data.devices.length === 0 && (
        <View style={[styles.emptyNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyNoticeText, { color: colors.mutedForeground }]}>
            Vincule o aparelho para que as rotinas tenham efeito. Nenhuma pausa ativa.
          </Text>
        </View>
      )}
      {data.routines.map((routine) => (
        <View key={routine.id} style={[styles.routineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routineTop}>
            <View style={[styles.routineIcon, { backgroundColor: routine.enabled ? colors.primary : colors.muted }]}>
              <Feather name={routine.icon as keyof typeof Feather.glyphMap || 'clock'} size={22} color={routine.enabled ? colors.primaryForeground : colors.mutedForeground} />
            </View>
            <View style={styles.routineInfo}>
              <Text style={[styles.routineTitle, { color: colors.foreground }]}>{routine.title}</Text>
              <Text style={[styles.routineDescription, { color: colors.mutedForeground }]}>{routine.description}</Text>
            </View>
            <Switch
              testID={`routine-toggle-${routine.id}`}
              value={routine.enabled}
              onValueChange={() => {
                void Haptics.selectionAsync();
                toggleRoutine(routine.id);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
          <View style={[styles.routineDivider, { backgroundColor: colors.border }]} />
          <View style={styles.routineMeta}>
            <View style={styles.metaItem}><Feather name="calendar" size={14} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{routine.days}</Text></View>
            <View style={styles.metaItem}><Feather name="clock" size={14} color={colors.mutedForeground} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{routine.start} às {routine.end}</Text></View>
          </View>
        </View>
      ))}

      <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="shield" size={20} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.foreground }]}>As rotinas ficam visíveis no dispositivo de {data.childName}, garantindo transparência.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1.2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 340 },
  
  tip: { flexDirection: 'row', padding: 20, borderRadius: 24, gap: 16, marginTop: 28, marginBottom: 32 },
  tipIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tipCopy: { flex: 1 },
  tipTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 6 },
  tipText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20 },
  
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginBottom: 16 },
  emptyNotice: { padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  emptyNoticeText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  
  routineCard: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 14 },
  routineTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  routineIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  routineInfo: { flex: 1 },
  routineTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  routineDescription: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  routineDivider: { height: 1, marginVertical: 18 },
  routineMeta: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  
  notice: { flexDirection: 'row', gap: 14, padding: 20, borderRadius: 20, borderWidth: 1, marginTop: 24, alignItems: 'center' },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
});