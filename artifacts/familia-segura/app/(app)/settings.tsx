import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '@/context/SubscriptionContext';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useFamily();
  const { hasPremiumAccess, isLoading } = useSubscription();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.nav}>
        <Pressable testID="settings-back" onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
      </View>
      
      <Text style={[styles.title, { color: colors.foreground }]}>Configurações</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Ajuste as preferências de segurança da família.</Text>
      
      <Pressable
        style={({ pressed }) => [
          styles.premiumCard,
          { backgroundColor: hasPremiumAccess ? colors.primary : colors.foreground },
          pressed && styles.pressed
        ]}
        onPress={() => router.push('/(app)/subscription')}
      >
        <View style={styles.premiumIconContainer}>
          <Feather name={hasPremiumAccess ? "shield" : "star"} size={22} color="#fff" />
        </View>
        <View style={styles.premiumCopy}>
          <Text style={styles.premiumTitle}>
            {isLoading ? 'Verificando...' : hasPremiumAccess ? 'Família Segura Premium' : 'Conheça o Premium'}
          </Text>
          <Text style={styles.premiumSub}>
            {isLoading ? 'Aguarde um momento' : hasPremiumAccess ? 'Gerencie sua assinatura ativa' : 'Monitoramento sem limites de tempo.'}
          </Text>
        </View>
        <Feather name="chevron-right" size={22} color="#fff" style={{ opacity: 0.6 }} />
      </Pressable>

      <Text style={[styles.groupTitle, { color: colors.foreground }]}>Preferências do App</Text>
      <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}><Feather name="bell" size={20} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Resumo diário</Text>
            <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>Notificação com o uso no fim do dia</Text>
          </View>
          <Switch value trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}><Feather name="eye" size={20} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Transparência ativa</Text>
            <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>Avisos claros na tela da criança</Text>
          </View>
          <Switch value trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} />
        </View>
      </View>
      
      <Text style={[styles.groupTitle, { color: colors.foreground }]}>Informações Técnicas</Text>
      <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}><Feather name="cloud" size={20} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Última sincronização</Text>
            <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>{data.lastSynced}</Text>
          </View>
        </View>
      </View>
      
      <View style={[styles.privacy, { backgroundColor: colors.secondary }]}>
        <Feather name="lock" size={20} color={colors.primary} />
        <Text style={[styles.privacyText, { color: colors.primary }]}>Nossos valores: O acompanhamento deve ser visível para todos os membros da família.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  nav: { marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1.2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 28 },
  
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    marginBottom: 32,
    gap: 16,
  },
  premiumIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCopy: { flex: 1 },
  premiumTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff', marginBottom: 4 },
  premiumSub: { fontFamily: 'Inter_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  
  groupTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 12 },
  group: { borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, marginBottom: 28 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 },
  settingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  settingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 2 },
  settingSub: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  divider: { height: 1 },
  
  privacy: { flexDirection: 'row', gap: 14, borderRadius: 20, padding: 20, alignItems: 'center' },
  privacyText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});