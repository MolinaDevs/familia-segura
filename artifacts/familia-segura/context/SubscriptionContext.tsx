import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import React, { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

export const PREMIUM_ENTITLEMENT = 'premium';
const ACCESS_CACHE_KEY = '@familia-segura/premium-access';
const VERIFICATION_GRACE_MS = 72 * 60 * 60 * 1000;

type CachedAccess = {
  appUserId: string;
  active: boolean;
  verifiedAt: number;
  expiresAt: number | null;
};

type AccessSource = 'verified' | 'grace' | 'basic';

export type SubscriptionContextValue = {
  offering: PurchasesOffering | null;
  packages: PurchasesPackage[];
  customerInfo: CustomerInfo | null;
  hasPremiumAccess: boolean;
  accessSource: AccessSource;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  isTestMode: boolean;
  errorMessage: string | null;
  purchase: (item: PurchasesPackage) => Promise<CustomerInfo>;
  restore: () => Promise<CustomerInfo>;
  manageSubscription: () => Promise<'opened' | 'none' | 'failed'>;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
let configuredApiKey: string | null = null;
let purchaseLoginUserId: string | null = null;
let purchaseLoginPromise: Promise<void> | null = null;

function isTestEnvironment() {
  return __DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient';
}

/**
 * A chave da loja de teste libera "compras" sem pagamento: só em build de desenvolvimento.
 * Web e Expo Go em produção ficam sem compras (a assinatura é feita no app das lojas).
 */
function testKeyAllowed() {
  return __DEV__;
}

function getRevenueCatApiKey() {
  const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  const selected = isTestEnvironment()
    ? (testKeyAllowed() ? testKey : undefined)
    : Platform.OS === 'ios'
      ? iosKey
      : androidKey;
  if (!selected) throw new Error('Compras indisponíveis nesta versão do aplicativo.');
  return selected;
}

function configureRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  if (configuredApiKey === apiKey) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  configuredApiKey = apiKey;
}

function ensurePurchaseLogin(userId: string): Promise<void> {
  configureRevenueCat();
  if (purchaseLoginUserId !== userId || !purchaseLoginPromise) {
    purchaseLoginUserId = userId;
    purchaseLoginPromise = Purchases.logIn(userId).then(
      () => undefined,
      (error: unknown) => {
        purchaseLoginUserId = null;
        purchaseLoginPromise = null;
        throw error;
      },
    );
  }
  return purchaseLoginPromise;
}

function activePremium(info: CustomerInfo | null | undefined) {
  return info?.entitlements.active[PREMIUM_ENTITLEMENT];
}

function accessExpiry(info: CustomerInfo) {
  const value = activePremium(info)?.expirationDate;
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function persistVerifiedAccess(appUserId: string, info: CustomerInfo) {
  const cached: CachedAccess = {
    appUserId,
    active: Boolean(activePremium(info)),
    verifiedAt: Date.now(),
    expiresAt: accessExpiry(info),
  };
  await AsyncStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(cached));
  return cached;
}

async function readCachedAccess(appUserId: string) {
  const raw = await AsyncStorage.getItem(ACCESS_CACHE_KEY);
  if (!raw) return null;
  const cached = JSON.parse(raw) as CachedAccess;
  return cached.appUserId === appUserId ? cached : null;
}

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { userId, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const identityKey = userId ?? 'signed-out';
  const [, setAccessClock] = useState(() => Date.now());

  const customerInfoQuery = useQuery({
    queryKey: ['revenuecat', 'customer-info', identityKey],
    enabled: Boolean(isSignedIn && userId),
    retry: 1,
    queryFn: async () => {
      await ensurePurchaseLogin(userId!);
      const info = await Purchases.getCustomerInfo();
      await persistVerifiedAccess(userId!, info);
      return info;
    },
    staleTime: 60_000,
  });

  const offeringsQuery = useQuery({
    queryKey: ['revenuecat', 'offerings', identityKey],
    enabled: Boolean(isSignedIn && userId),
    retry: 1,
    queryFn: async () => {
      await ensurePurchaseLogin(userId!);
      return Purchases.getOfferings();
    },
    staleTime: 5 * 60_000,
  });

  const cachedAccessQuery = useQuery({
    queryKey: ['revenuecat', 'cached-access', identityKey],
    enabled: Boolean(userId),
    queryFn: () => readCachedAccess(userId!),
  });

  useEffect(() => {
    if (!isSignedIn) {
      queryClient.removeQueries({ queryKey: ['revenuecat'] });
    }
  }, [isSignedIn, queryClient]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let cancelled = false;
    const updateFromRevenueCat = async (info: CustomerInfo) => {
      if (cancelled) return;
      await persistVerifiedAccess(userId, info);
      queryClient.setQueryData(['revenuecat', 'customer-info', identityKey], info);
      await queryClient.invalidateQueries({ queryKey: ['revenuecat', 'cached-access', identityKey] });
      setAccessClock(Date.now());
    };
    const listener = (info: CustomerInfo) => {
      void updateFromRevenueCat(info);
    };
    const prepare = async () => {
      await ensurePurchaseLogin(userId);
      if (cancelled) return;
      Purchases.addCustomerInfoUpdateListener(listener);
    };
    void prepare().catch((error: unknown) => {
      console.warn('Não foi possível iniciar a verificação de assinatura.', error);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queryClient.invalidateQueries({ queryKey: ['revenuecat', 'customer-info', identityKey] });
        void queryClient.invalidateQueries({ queryKey: ['revenuecat', 'offerings', identityKey] });
      }
    });
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
      appStateSubscription.remove();
    };
  }, [identityKey, isSignedIn, queryClient, userId]);

  const updateCustomerInfo = async (info: CustomerInfo) => {
    if (userId) {
      await persistVerifiedAccess(userId, info);
      await cachedAccessQuery.refetch();
    }
    queryClient.setQueryData(['revenuecat', 'customer-info', identityKey], info);
    return info;
  };

  const purchaseMutation = useMutation({
    mutationFn: async (item: PurchasesPackage) => {
      configureRevenueCat();
      const result = await Purchases.purchasePackage(item);
      if (!activePremium(result.customerInfo)) {
        throw new Error('A loja concluiu a compra, mas o acesso Premium ainda não foi confirmado. Use Restaurar compras.');
      }
      return updateCustomerInfo(result.customerInfo);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      configureRevenueCat();
      return updateCustomerInfo(await Purchases.restorePurchases());
    },
  });

  const liveEntitlement = activePremium(customerInfoQuery.data);
  const liveExpiry = customerInfoQuery.data ? accessExpiry(customerInfoQuery.data) : null;
  const verifiedPremium = Boolean(liveEntitlement)
    && (liveExpiry === null || Date.now() < liveExpiry);
  const cached = cachedAccessQuery.data;
  const graceDeadline = cached
    ? Math.min(
      cached.verifiedAt + VERIFICATION_GRACE_MS,
      cached.expiresAt ?? Number.POSITIVE_INFINITY,
    )
    : 0;
  const gracePremium = !customerInfoQuery.data
    && Boolean(cached?.active)
    && Date.now() < graceDeadline;
  const hasPremiumAccess = verifiedPremium || gracePremium;
  const accessSource: AccessSource = verifiedPremium ? 'verified' : gracePremium ? 'grace' : 'basic';
  const error = customerInfoQuery.error ?? offeringsQuery.error ?? purchaseMutation.error ?? restoreMutation.error;

  useEffect(() => {
    const nextDeadline = liveExpiry ?? (cached?.active ? graceDeadline : 0);
    if (!nextDeadline || !Number.isFinite(nextDeadline)) return;
    const delay = Math.max(100, Math.min(nextDeadline - Date.now() + 100, 2_147_000_000));
    const timer = setTimeout(() => {
      setAccessClock(Date.now());
      void customerInfoQuery.refetch();
    }, delay);
    return () => clearTimeout(timer);
  }, [cached?.active, customerInfoQuery.data, graceDeadline, liveExpiry]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    offering: offeringsQuery.data?.current ?? null,
    packages: offeringsQuery.data?.current?.availablePackages ?? [],
    customerInfo: customerInfoQuery.data ?? null,
    hasPremiumAccess,
    accessSource,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading || cachedAccessQuery.isLoading,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isTestMode: isTestEnvironment(),
    errorMessage: error instanceof Error ? error.message : error ? 'Não foi possível verificar a assinatura.' : null,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    manageSubscription: async () => {
      // Assinatura de loja: abre a página dela. Premium de cortesia (concedido pela equipe) ou comprado em outra
      // plataforma não tem o que gerenciar aqui — o app explica em vez de não fazer nada.
      const managementURL = customerInfoQuery.data?.managementURL;
      if (!managementURL) return 'none' as const;
      try {
        await Linking.openURL(managementURL);
        return 'opened' as const;
      } catch {
        return 'failed' as const;
      }
    },
    refresh: async () => {
      await Promise.all([customerInfoQuery.refetch(), offeringsQuery.refetch()]);
    },
  }), [
    offeringsQuery.data,
    offeringsQuery.isLoading,
    customerInfoQuery.data,
    customerInfoQuery.isLoading,
    cachedAccessQuery.isLoading,
    hasPremiumAccess,
    accessSource,
    purchaseMutation.isPending,
    restoreMutation.isPending,
    error,
  ]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription precisa estar dentro de SubscriptionProvider');
  return value;
}