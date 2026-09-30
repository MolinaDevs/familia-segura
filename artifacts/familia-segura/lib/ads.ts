import { Platform } from 'react-native';
import type { FamilyOverview } from '@workspace/api-client-react';

/**
 * Anúncios do plano grátis — regras (docs/PLANO_LANCAMENTO.md §4):
 * 1. Só no app do responsável; o modo criança nunca mostra nem pede anúncio (ECA Digital, Google Play Families).
 * 2. Sem personalização e classificação de conteúdo "G".
 * 3. Só um banner discreto no fim de Relatórios e de Apps; nada de tela cheia.
 * 4. Carência de 3 dias depois de criar a família.
 * 5. Sem ID real configurado, aparece só o cartão da casa (anúncio de teste nunca vai para produção).
 */
export const AD_GRACE_DAYS = 3;

/** IDs dos blocos de anúncio (AdMob) — o dono configura em EXPO_PUBLIC_ADMOB_BANNER_ANDROID/IOS. */
export function bannerUnitId(testId: string): string | null {
  const configured = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS
    : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
  if (configured) return configured;
  return __DEV__ ? testId : null;
}

/** Mostrar anúncio para esta família agora? (plano grátis e passada a carência) */
export function shouldShowAds(overview?: FamilyOverview | null, now = Date.now()) {
  if (!overview?.limits || overview.limits.features.adFree) return false;
  const createdAt = new Date(overview.family.createdAt).getTime();
  return now - createdAt >= AD_GRACE_DAYS * 24 * 3600_000;
}
