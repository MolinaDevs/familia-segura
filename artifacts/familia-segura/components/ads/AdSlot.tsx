import { oneLine, spaced } from '@/lib/text';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import mobileAds, { BannerAd, BannerAdSize, MaxAdContentRating, TestIds } from 'react-native-google-mobile-ads';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { bannerUnitId, shouldShowAds } from '@/lib/ads';
import { HouseAd } from './HouseAd';

let initialization: Promise<unknown> | null = null;

/** Inicializa o SDK só quando um banner vai aparecer (o modo criança nunca chega aqui). */
function ensureAdsReady() {
  initialization ??= mobileAds()
    .setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    })
    .then(() => mobileAds().initialize());
  return initialization;
}

/**
 * Espaço de anúncio do plano grátis: um banner discreto, com o selo "Publicidade", no fim da tela.
 * Não aparece no Premium, nos 3 primeiros dias nem sem ID configurado (aí fica o cartão da casa).
 */
export function AdSlot() {
  const colors = useColors();
  const { overview } = useFamily();
  const show = shouldShowAds(overview);
  const unitId = bannerUnitId(TestIds.ADAPTIVE_BANNER);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!show || !unitId) return;
    let active = true;
    ensureAdsReady().then(() => { if (active) setReady(true); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [show, unitId]);

  if (!show) return null;
  if (!unitId || failed) return <HouseAd />;
  if (!ready) return null;
  return (
    <View style={[styles.slot, { borderColor: colors.border }]} testID="ad-slot">
      <Text {...oneLine} style={[styles.label, { color: colors.mutedForeground }]}>{spaced('Publicidade')}</Text>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { marginTop: 24, borderTopWidth: 1, paddingTop: 8, alignItems: 'center', gap: 6 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 10.5, letterSpacing: 0.8, alignSelf: 'flex-start' },
});
