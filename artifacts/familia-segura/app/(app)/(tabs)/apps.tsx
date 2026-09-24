import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { StatusPill } from '@/components/StatusPill';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useFamily();
  const sortedApps = useMemo(() => data.devices.length === 0 ? [] : [...data.apps].sort((a, b) => b.usageToday - a.usageToday), [data.apps, data.devices.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sortedApps}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16, paddingBottom: Platform.OS === 'web' ? 118 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>CONTROLE DE APPS</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>Aplicativos</Text>
            </View>
            <Pressable testID="apps-settings" onPress={() => router.push('/settings')} style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="sliders" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const percent = item.dailyLimit ? Math.min(100, Math.round((item.usageToday / item.dailyLimit) * 100)) : 0;
          return (
            <Pressable testID={`app-row-${item.id}`} onPress={() => router.push({ pathname: '/app/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.appCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
              <View style={styles.appTop}>
                <AppIcon name={item.icon} color={item.iconColor} size={46} />
                <View style={styles.appInfo}>
                  <Text style={[styles.appName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.category, { color: colors.mutedForeground }]}>{item.category}</Text>
                </View>
                <StatusPill status={item.status} />
              </View>
              <View style={styles.usageLine}>
                <Text style={[styles.usageText, { color: colors.foreground }]}>{item.usageToday} min hoje</Text>
                <Text style={[styles.limitText, { color: colors.mutedForeground }]}>{item.dailyLimit ? `limite de ${item.dailyLimit} min` : 'acesso restrito'}</Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.muted }]}>
                <View style={[styles.progress, { width: `${percent}%`, backgroundColor: percent > 90 ? colors.destructive : colors.primary }]} />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="grid" size={32} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>Nenhum app monitorado</Text>
            <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>
              {data.devices.length === 0 ? `Vincule um aparelho para começar a acompanhar o uso de ${data.childName}.` : 'O monitoramento estará visível assim que os apps forem detectados.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1.2 },
  iconButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  
  appCard: { borderRadius: 24, borderWidth: 1, padding: 20 },
  appTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  appInfo: { flex: 1 },
  appName: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  category: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  
  usageLine: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  usageText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  limitText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  track: { height: 8, borderRadius: 8, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 8 },

  emptyState: { padding: 32, borderRadius: 24, borderWidth: 1, alignItems: 'center', marginTop: 10 },
  emptyStateTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 8 },
  emptyStateText: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});