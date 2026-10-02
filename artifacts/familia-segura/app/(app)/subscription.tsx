import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator, 
  Modal, Linking
} from 'react-native';
import { Icon } from '@/components/Icon';
import { Emblem } from '@/components/brand/Logo';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useSubscription } from '@/context/SubscriptionContext';
import { useFamily } from '@/context/AppContext';
import type { PurchasesPackage } from 'react-native-purchases';

import { goBack } from '@/lib/navigation';
import { openLegal } from '@/lib/legal';
import { Alert } from '@/lib/alert';
/** Período da loja em ISO 8601 (P1M, P3M, P1Y, P1W) → texto em português. */
function periodLabel(period?: string | null) {
  if (!period) return '';
  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match) return '';
  const n = Number(match[1]);
  const unit = { D: ['dia', 'dias'], W: ['semana', 'semanas'], M: ['mês', 'meses'], Y: ['ano', 'anos'] }[match[2] as 'D' | 'W' | 'M' | 'Y'];
  return n === 1 ? `por ${unit[0]}` : `a cada ${n} ${unit[1]}`;
}

/** Grátis × Premium (docs/PLANO_LANCAMENTO.md §3). Segurança igual nos dois; o Premium vende escala e conforto. */
const PLAN_ROWS: Array<{ label: string; free: string | boolean; premium: string | boolean }> = [
  { label: 'Crianças e aparelhos', free: '1 e 1', premium: 'até 10 e 10' },
  { label: 'Responsáveis na família', free: '1', premium: 'até 4' },
  { label: 'Apps com limite de tempo', free: 'até 5', premium: 'ilimitados' },
  { label: 'Rotinas por criança', free: 'até 2', premium: 'ilimitadas' },
  { label: 'Travar a tela na hora de dormir', free: false, premium: true },
  { label: 'Relatórios', free: '7 dias', premium: '12 meses' },
  { label: 'Resumo semanal no celular', free: false, premium: true },
  { label: 'Sem anúncios', free: false, premium: true },
  { label: 'Bloquear, pausar agora, filtro adulto e proteção contra desinstalar', free: true, premium: true },
];

function PlanCell({ value, highlight }: { value: string | boolean; highlight?: boolean }) {
  const colors = useColors();
  if (typeof value === 'boolean') {
    return value
      ? <Icon name="check-circle" size={18} color={highlight ? colors.primary : colors.success} />
      : <Icon name="x" size={16} color={colors.mutedForeground} />;
  }
  return <Text style={[styles.cellText, { color: highlight ? colors.primary : colors.foreground }]}>{value}</Text>;
}

function PlanComparison() {
  const colors = useColors();
  return (
    <View style={[styles.compare, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.compareRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.compareHead, { color: colors.mutedForeground, flex: 1.6 }]}>RECURSO</Text>
        <Text style={[styles.compareHead, { color: colors.mutedForeground }]}>GRÁTIS</Text>
        <Text style={[styles.compareHead, { color: colors.primary }]}>PREMIUM</Text>
      </View>
      {PLAN_ROWS.map((row, i) => (
        <View key={row.label} style={[styles.compareRow, i < PLAN_ROWS.length - 1 && { borderBottomColor: colors.border }]}>
          <Text style={[styles.compareLabel, { color: colors.foreground }]}>{row.label}</Text>
          <View style={styles.compareCell}><PlanCell value={row.free} /></View>
          <View style={styles.compareCell}><PlanCell value={row.premium} highlight /></View>
        </View>
      ))}
    </View>
  );
}

export default function SubscriptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { 
    hasPremiumAccess, 
    accessSource,
    packages, 
    isLoading, 
    isPurchasing,
    isRestoring,
    isTestMode,
    errorMessage,
    purchase, 
    restore,
    manageSubscription
  } = useSubscription();

  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [pendingPackage, setPendingPackage] = useState<PurchasesPackage | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-select first package when they load
  useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      setSelectedPackage(packages[0]);
    }
  }, [packages, selectedPackage]);

  const handleManage = async () => {
    const result = await manageSubscription();
    if (result === 'opened') return;
    Alert.alert(
      'Gerenciar assinatura',
      result === 'none'
        ? 'Este Premium não está ligado a uma assinatura da loja neste aparelho (cortesia ou compra feita em outro aparelho/loja). Para cancelar ou trocar o plano, abra as assinaturas da Google Play ou da App Store na conta que fez a compra.'
        : 'Não foi possível abrir a página de assinaturas. Abra a Google Play ou a App Store e procure "Assinaturas" na sua conta.',
    );
  };

  const handlePurchasePress = (pkg: PurchasesPackage) => {
    if (isTestMode) {
      setPendingPackage(pkg);
      setTestModalVisible(true);
    } else {
      executePurchase(pkg);
    }
  };

  const executePurchase = async (pkg: PurchasesPackage) => {
    try {
      setSuccessMessage(null);
      await purchase(pkg);
      setSuccessMessage("Assinatura ativada com sucesso.");
    } catch (error: any) {
      // User cancellation is normal, no alert needed
      if (error?.userCancelled) return;
    }
  };

  const handleRestore = async () => {
    try {
      setSuccessMessage(null);
      const info = await restore();
      if (info.entitlements.active.premium) {
        setSuccessMessage("Compras restauradas com sucesso.");
      } else {
        setSuccessMessage("Nenhuma assinatura ativa foi encontrada nesta conta.");
      }
    } catch (error: any) {
      // Neutrally handled
    }
  };

  const { data } = useFamily();
  const active = hasPremiumAccess;

  const renderContent = () => {
    if (isLoading && !packages.length) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Carregando opções...
          </Text>
        </View>
      );
    }

    if (!packages.length && !errorMessage) {
      return (
        <View style={styles.paywallContainer}>
          <View style={styles.header}>
            <Emblem size={84} />
            <Text style={[styles.title, { color: colors.foreground }]}>Família Segura Premium</Text>
            <PlanComparison />
          </View>
          <View style={[styles.centerContainer, { flex: 0, paddingVertical: 16 }]}>
            <Icon name="wifi-off" size={24} color={colors.mutedForeground} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground, textAlign: 'center' }]}>
              Os preços não carregaram agora. Confira a internet e tente de novo em instantes.
            </Text>
          </View>
        </View>
      );
    }

    // A família herda o Premium do titular: co-responsável não deve assinar (pagaria sem liberar nada).
    if (!active && data.role !== 'owner') {
      const familyPremium = data.limits?.plan === 'premium';
      return (
        <View style={styles.activeContainer}>
          <View style={[styles.statusBadge, { backgroundColor: familyPremium ? colors.primary : colors.muted }]}>
            <Icon name={familyPremium ? 'shield' : 'info'} size={32} color={familyPremium ? colors.primaryForeground : colors.mutedForeground} />
          </View>
          <Text style={[styles.activeTitle, { color: colors.foreground }]}>
            {familyPremium ? 'Sua família já é Premium' : 'A assinatura é do titular'}
          </Text>
          <Text style={[styles.activeDesc, { color: colors.mutedForeground }]}>
            {familyPremium
              ? 'O titular da família assina o Premium e todos os responsáveis usam os recursos.'
              : 'O Premium é contratado pelo titular da família e vale para todos os responsáveis. Peça para ele assinar pelo app.'}
          </Text>
        </View>
      );
    }

    if (active) {
      return (
        <View style={styles.activeContainer}>
          <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
            <Icon name="shield" size={32} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.activeTitle, { color: colors.foreground }]}>
            Sua família está protegida
          </Text>
          <Text style={[styles.activeDesc, { color: colors.mutedForeground }]}>
            {accessSource === 'grace' 
              ? "Estamos verificando o status da sua assinatura, mas você continua com acesso total."
              : "Você possui acesso total e ilimitado aos recursos Premium do Família Segura."}
          </Text>

          <Pressable 
            style={({ pressed }) => [
              styles.actionButton, 
              { backgroundColor: colors.foreground },
              pressed && styles.pressed
            ]}
            onPress={() => void handleManage()}
          >
            <Text style={[styles.actionButtonText, { color: colors.background }]}>Gerenciar assinatura</Text>
          </Pressable>

          <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Icon name="info" size={20} color={colors.secondaryForeground} />
            <Text style={[styles.infoBoxText, { color: colors.secondaryForeground }]}>
              Caso a assinatura expire, o aplicativo retorna ao acesso básico. Suas configurações de segurança e limites atuais não serão apagados.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.paywallContainer}>
        <View style={styles.header}>
          <Emblem size={84} />
          <Text style={[styles.title, { color: colors.foreground }]}>Família Segura Premium</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Para famílias com mais de uma criança, mais de um aparelho ou mais de um responsável.
          </Text>
          <PlanComparison />
        </View>

        <View style={styles.packagesList}>
          {packages.map((pkg) => {
            const isSelected = selectedPackage?.identifier === pkg.identifier;
            const period = periodLabel(pkg.product.subscriptionPeriod);
            return (
              <Pressable
                key={pkg.identifier}
                style={[
                  styles.packageCard,
                  { 
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => setSelectedPackage(pkg)}
              >
                <View style={styles.packageInfo}>
                  <Text style={[styles.packageName, { color: colors.foreground }]}>
                    {pkg.product.title.replace(/\(.*\)/, '').trim()}
                  </Text>
                  <Text style={[styles.packageDesc, { color: colors.mutedForeground }]}>
                    {pkg.product.description}
                  </Text>
                </View>
                <View style={styles.packagePriceBox}>
                  <Text style={[styles.packagePrice, { color: colors.foreground }]}>
                    {pkg.product.priceString}
                  </Text>
                  {period ? <Text style={[styles.packagePeriod, { color: colors.mutedForeground }]}>{period}</Text> : null}
                </View>
                
                {isSelected && (
                  <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                    <Icon name="check" size={14} color={colors.primaryForeground} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actionsBox}>
          <Pressable 
            style={({ pressed }) => [
              styles.subscribeButton, 
              { backgroundColor: selectedPackage ? colors.primary : colors.muted },
              pressed && selectedPackage && styles.pressed
            ]}
            disabled={!selectedPackage || isPurchasing}
            onPress={() => selectedPackage && handlePurchasePress(selectedPackage)}
          >
            {isPurchasing ? (
              <ActivityIndicator color={selectedPackage ? colors.primaryForeground : colors.mutedForeground} />
            ) : (
              <Text style={[
                styles.subscribeButtonText, 
                { color: selectedPackage ? colors.primaryForeground : colors.mutedForeground }
              ]}>
                Continuar
              </Text>
            )}
          </Pressable>

          <Text style={[styles.renewalText, { color: colors.mutedForeground }]}>
            A assinatura é renovada automaticamente pelo período escolhido, pelo preço exibido pela loja, até ser cancelada. Você pode cancelar a renovação nas configurações da App Store ou Google Play.
          </Text>

          <Pressable 
            style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
            disabled={isRestoring}
            onPress={handleRestore}
          >
            <Text style={[styles.restoreButtonText, { color: colors.foreground }]}>
              {isRestoring ? 'Restaurando...' : 'Restaurar compras'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 30 }
        ]}
      >
        <View style={styles.nav}>
          <Pressable testID="sub-back" onPress={() => goBack('/(app)/(tabs)/profile')} hitSlop={10}>
            <Icon name="x" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        {errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive }]}>
            <Text style={[styles.errorText, { color: colors.destructiveForeground }]}>{errorMessage}</Text>
          </View>
        )}

        {successMessage && (
          <View style={[styles.successBox, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.successText, { color: colors.secondaryForeground }]}>{successMessage}</Text>
          </View>
        )}

        {renderContent()}

        <View style={styles.legalLinks}>
          <Pressable onPress={() => void openLegal('terms')}><Text style={[styles.legalText, { color: colors.mutedForeground }]}>Termos</Text></Pressable>
          <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>•</Text>
          <Pressable onPress={() => void openLegal('privacy')}><Text style={[styles.legalText, { color: colors.mutedForeground }]}>Privacidade</Text></Pressable>
          <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>•</Text>
          <Pressable onPress={() => void openLegal('support')}><Text style={[styles.legalText, { color: colors.mutedForeground }]}>Suporte</Text></Pressable>
        </View>
      </ScrollView>

      {/* Test Mode Modal Confirmation */}
      <Modal
        visible={testModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Icon name="alert-circle" size={24} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Ambiente de Teste</Text>
            </View>
            <Text style={[styles.modalText, { color: colors.mutedForeground }]}>
              Você está prestes a realizar uma compra simulada para o pacote {pendingPackage?.product.title}. Nenhuma cobrança real será feita.
            </Text>
            <View style={styles.modalActions}>
              <Pressable 
                style={styles.modalCancel} 
                onPress={() => {
                  setTestModalVisible(false);
                  setPendingPackage(null);
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalConfirm, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setTestModalVisible(false);
                  if (pendingPackage) {
                    executePurchase(pendingPackage);
                    setPendingPackage(null);
                  }
                }}
              >
                <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>Confirmar Teste</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 15,
    marginTop: 16,
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorText: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  successBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  successText: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  activeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  statusBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  activeTitle: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  activeDesc: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 40,
  },
  actionButtonText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 16,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 12,
  },
  infoBoxText: {
    flex: 1,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  paywallContainer: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  packagesList: {
    gap: 16,
    marginBottom: 40,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    position: 'relative',
  },
  packageInfo: {
    flex: 1,
    paddingRight: 16,
  },
  packageName: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 17,
    marginBottom: 4,
  },
  packageDesc: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 13,
  },
  packagePriceBox: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 18,
  },
  packagePeriod: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 11,
    marginTop: 3,
  },
  selectedIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  actionsBox: {
    marginTop: 'auto',
  },
  subscribeButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  subscribeButtonText: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 16,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
  },
  renewalText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 8,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
  },
  legalText: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 18,
  },
  modalText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,
  },
  modalCancelText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
  },
  modalConfirm: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,
  },
  modalConfirmText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.7,
  },
  compare: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 18, marginTop: 16, overflow: 'hidden' },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  compareHead: { flex: 1, fontFamily: 'NunitoSans_800ExtraBold', fontSize: 10.5, letterSpacing: 1, textAlign: 'center' },
  compareLabel: { flex: 1.6, fontFamily: 'NunitoSans_600SemiBold', fontSize: 13, lineHeight: 18 },
  compareCell: { flex: 1, alignItems: 'center' },
  cellText: { fontFamily: 'NunitoSans_700Bold', fontSize: 12.5, textAlign: 'center' },
});
