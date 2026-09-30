import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthButton } from '@/components/auth/AuthKit';
import { BrandBackground } from '@/components/brand/BrandBackground';
import { BreathingEmblem } from '@/components/brand/Logo';
import { Icon, type IconName } from '@/components/Icon';
import { useFamily } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export const WELCOME_TOUR_KEY = 'welcome-tour-done';

type Slide = { icon?: IconName; step?: string; title: string; body: string; tint?: 'blueSoft' | 'peachSoft' | 'mintSoft' | 'sunSoft' };

/**
 * Boas-vindas logo depois de criar a família: como o app funciona em 4 telas curtas, com "Pular".
 * Depois disso, o guia "Primeiros passos" do painel acompanha cada etapa.
 */
export default function WelcomeTour() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useFamily();
  const [index, setIndex] = useState(0);
  const child = data.childName || 'sua criança';

  const slides: Slide[] = [
    {
      title: 'Tudo pronto para começar',
      body: `Em poucos minutos o celular de ${child} passa a seguir os combinados da família — e ${child} vê as mesmas regras que você.`,
    },
    {
      icon: 'smartphone', step: 'PASSO 1', tint: 'blueSoft',
      title: `Conecte o celular de ${child}`,
      body: 'Instale o Família Segura no aparelho da criança e toque em "Este é o celular do seu filho?". Aqui, em Família → + Parear, você gera o código.',
    },
    {
      icon: 'shield', step: 'PASSO 2', tint: 'mintSoft',
      title: 'Ative a proteção com o seu PIN',
      body: 'No aparelho da criança, siga os passos de proteção. O PIN impede que o app seja apagado ou desligado sem você.',
    },
    {
      icon: 'sliders', step: 'PASSO 3', tint: 'peachSoft',
      title: 'Ajuste os combinados',
      body: 'Já sugerimos limites e rotinas pela idade. Mude quando quiser — e use "Pausar agora" no painel quando precisar.',
    },
  ];
  const slide = slides[index];
  const last = index === slides.length - 1;

  const finish = () => {
    void AsyncStorage.setItem(WELCOME_TOUR_KEY, 'true').catch(() => undefined);
    router.replace('/(app)');
  };

  return (
    <BrandBackground>
      <View style={[styles.wrap, { paddingTop: (Platform.OS === 'web' ? 24 : insets.top) + 8, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.top}>
          <View style={styles.dots} accessibilityLabel={`Tela ${index + 1} de ${slides.length}`}>
            {slides.map((s, i) => (
              <View key={s.title} style={[styles.dot, { backgroundColor: i <= index ? colors.primary : colors.border, width: i === index ? 26 : 8 }]} />
            ))}
          </View>
          {!last ? (
            <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" testID="tour-skip">
              <Text style={[styles.skip, { color: colors.mutedForeground }]}>Pular</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          {slide.icon ? (
            <View style={[styles.iconBubble, { backgroundColor: colors[slide.tint ?? 'blueSoft'] }]}>
              <Icon name={slide.icon} size={44} color={colors.navy} />
            </View>
          ) : (
            <BreathingEmblem size={150} />
          )}
          {slide.step ? <Text style={[styles.step, { color: colors.accent }]}>{slide.step}</Text> : null}
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>{slide.title}</Text>
          <Text style={[styles.text, { color: colors.mutedForeground }]}>{slide.body}</Text>
        </View>

        <View style={styles.actions}>
          <AuthButton label={last ? 'Ir para o painel' : index === 0 ? 'Mostrar como' : 'Próximo'}
            onPress={() => (last ? finish() : setIndex(index + 1))} testID="tour-next" />
          {index > 0 ? (
            <AuthButton label="Voltar" variant="quiet" onPress={() => setIndex(index - 1)} />
          ) : null}
        </View>
      </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  skip: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', gap: 12 },
  iconBubble: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  step: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 12, letterSpacing: 1.6, marginTop: 8 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  text: { fontFamily: 'NunitoSans_500Medium', fontSize: 16.5, lineHeight: 25 },
  actions: { gap: 6 },
});
