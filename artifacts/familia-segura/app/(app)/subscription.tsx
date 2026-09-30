import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator, 
  Modal, Linking
} from 'react-native';
import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useSubscription } from '@/context/SubscriptionContext';
import { useFamily } from '@/context/AppContext';
import type { PurchasesPackage } from 'react-native-purchases';

import { goBack } from '@/lib/navigation';
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

  const domain = process.env.EXPO_PUBLIC_DOMAIN;

  const handleLink = (path: string) => {
    if (!domain) return;
    Linking.openURL(`https://${domain}${path}`).catch(() => undefined);
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
        <View style={styles.centerContainer}>
          <Icon name="wifi-off" size={28} color={colors.mutedForeground} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Os planos não estão disponíveis agora. Tente novamente em instantes.
          </Text>
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
            onPress={manageSubscription}
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
          <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
            <Icon name="star" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Família Segura Premium</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Até 10 crianças e 10 aparelhos (iPhone e Android), até 4 responsáveis e 12 meses de relatórios.
          </Text>
          <View style={{ gap: 6, marginTop: 14, alignSelf: 'stretch' }}>
            {[
              'Até 10 crianças e 10 aparelhos na mesma família',
              'Convide o outro responsável ou um observador',
              'Gráficos de uso com histórico de até 12 meses',
              'O básico continua grátis: 1 criança, 1 aparelho, limites e bloqueios',
            ].map((item) => (
              <View key={item} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="check" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontFamily: 'NunitoSans_500Medium', fontSize: 14, lineHeight: 20, color: colors.foreground }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.packagesList}>
          {packages.map((pkg) => {
            const isSelected = selectedPackage?.identifier === pkg.identifier;
            const period = pkg.product.subscriptionPeriod === 'P1Y'
              ? 'por ano'
              : pkg.product.subscriptionPeriod === 'P1M'
                ? 'por mês'
                : pkg.product.subscriptionPeriod
                  ? `a cada ${pkg.product.subscriptionPeriod}`
                  : '';
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
          <Pressable onPress={() => handleLink('/api/legal/terms')}><Text style={[styles.legalText, { color: colors.mutedForeground }]}>Termos</Text></Pressable>
          <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>•</Text>
          <Pressable onPress={() => handleLink('/api/legal/privacy')}><Text style={[styles.legalText, { color: colors.mutedForeground }]}>Privacidade</Text></Pressable>
          <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>•</Text>
          <Pressable onPress={() => handleLink('/api/legal/support')}><Text style={[styles.legalText, { color: colors.mutedForeground }]}>Suporte</Text></Pressable>
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
});
