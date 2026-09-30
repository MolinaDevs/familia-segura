import React from 'react';
import { useFamily } from '@/context/AppContext';
import { shouldShowAds } from '@/lib/ads';
import { HouseAd } from './HouseAd';

/** Na web não há SDK de anúncios: no lugar do banner fica o cartão da casa (mesmas regras de exibição). */
export function AdSlot() {
  const { overview } = useFamily();
  return shouldShowAds(overview) ? <HouseAd /> : null;
}
