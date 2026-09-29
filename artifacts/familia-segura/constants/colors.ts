/**
 * Tokens de cor do app (claro e escuro). `useColors()` escolhe a paleta pelo tema do aparelho.
 * Não use cores fixas nas telas: acrescente um token aqui.
 *
 * Sistema "Algodão & Mochi" (docs/DESIGN.md): verde de bebê é a casa, lilás é ação, rosa é assinatura.
 * Regra: pastel é superfície, nunca texto. Todo par de texto abaixo foi medido (WCAG AA ≥ 4,5:1).
 */

const light = {
  text: '#2E2545',
  tint: '#6D3FD1',

  background: '#EFF8F2',
  foreground: '#2E2545',

  card: '#FAFDFB',
  cardForeground: '#2E2545',

  // Lavanda: ação (botão, link, foco, item ativo).
  primary: '#6D3FD1',
  primaryForeground: '#FFFFFF',

  secondary: '#F2ECFB',
  secondaryForeground: '#5A2FC0',

  muted: '#E7F0EA',
  mutedForeground: '#675C80',

  // Rosa: assinatura da marca (selo, destaque, linha de limite nos gráficos).
  accent: '#C2185B',
  accentForeground: '#FFFFFF',

  destructive: '#C32B41',
  destructiveForeground: '#FFFFFF',

  border: '#D8E7DD',
  input: '#C9DACF',

  success: '#0F7A66',
  successSoft: '#DDF3EC',
  warning: '#87610A',
  warningSoft: '#FFF4D6',
  dangerSoft: '#FBE4E8',

  chartGrid: '#D8E7DD',
  chartBar: '#6D3FD1',
  chartBarMuted: '#CDBDFB',
  chartLimit: '#C2185B',
  chartHeatLow: '#EAF4EE',
  chartHeatHigh: '#4B2A99',

  // Superfícies da marca (nunca texto).
  mochi: '#FF8FA9',
  mint: '#7FD8C3',
  butter: '#FFD97D',
  grapeLite: '#CDBDFB',
  skyTop: '#EFF8F2',
  skyMid: '#E6F4EB',
  skyBottom: '#F0ECFA',
  shadow: '#4B7A5E',

  // Marca (mascote): contorno, corpo e brilho mudam com o tema para o contorno não sumir no escuro.
  markInk: '#2E2545',
  markBody: '#DCCEFD',
  markShine: '#FAFDFB',
};

const dark: typeof light = {
  text: '#EDE8F7',
  tint: '#B9A2FB',

  background: '#16121F',
  foreground: '#EDE8F7',

  card: '#201A2C',
  cardForeground: '#EDE8F7',

  primary: '#B9A2FB',
  primaryForeground: '#1B1030',

  secondary: '#2A2140',
  secondaryForeground: '#D9CCFD',

  muted: '#241E32',
  mutedForeground: '#A99FBF',

  accent: '#FF8FA9',
  accentForeground: '#2A0A14',

  destructive: '#F58A9C',
  destructiveForeground: '#2A0A10',

  border: '#30283F',
  input: '#3B3150',

  success: '#7FD8C3',
  successSoft: '#15302A',
  warning: '#FFD97D',
  warningSoft: '#33290F',
  dangerSoft: '#3A1620',

  chartGrid: '#30283F',
  chartBar: '#B9A2FB',
  chartBarMuted: '#3E3160',
  chartLimit: '#FF8FA9',
  chartHeatLow: '#221C2F',
  chartHeatHigh: '#CDBDFB',

  mochi: '#FF8FA9',
  mint: '#7FD8C3',
  butter: '#FFD97D',
  grapeLite: '#CDBDFB',
  skyTop: '#16121F',
  skyMid: '#171722',
  skyBottom: '#1D1630',
  shadow: '#000000',

  markInk: '#EDE8F7',
  markBody: '#4A3A78',
  markShine: '#CDBDFB',
};

const colors = {
  light,
  dark,
  radius: 24,
};

export type Palette = typeof light;
export default colors;
