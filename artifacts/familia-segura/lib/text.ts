import { Platform, type TextProps } from 'react-native';

/**
 * Android (visto em Xiaomi): texto com espaçamento entre letras e largura automática é medido alguns pontos
 * mais estreito do que é desenhado — a última letra/palavra cai para outra linha e some. Duas defesas:
 * - rótulos em "pílulas" (largura automática): uma linha só, sem reticências, com dois espaços no fim para a
 *   diferença cair em branco (`oneLine` + `spaced`);
 * - textos soltos centralizados: largura do pai (`alignSelf: 'stretch'` + `textAlign: 'center'`), sem medir.
 */
export const oneLine: Pick<TextProps, 'numberOfLines' | 'ellipsizeMode' | 'textBreakStrategy'> = {
  numberOfLines: 1,
  ellipsizeMode: 'clip',
  textBreakStrategy: 'simple',
};

export const spaced = (label: string) => (Platform.OS === 'android' ? `${label}  ` : label);
