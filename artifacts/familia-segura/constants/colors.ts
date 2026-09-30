/**
 * Tokens de cor do app (claro e escuro). `useColors()` escolhe a paleta pelo tema do aparelho.
 * Não use cores fixas nas telas: acrescente um token aqui.
 *
 * Sistema "Azul Confiança" (docs/DESIGN.md), tirado do logo: azul-marinho do escudo = confiança e ação,
 * laranja-pêssego da família = acolhimento, creme do fundo do logo = a casa.
 * Regra: tom claro é superfície, nunca texto. Todo par de texto abaixo foi medido (WCAG AA ≥ 4,5:1).
 */

const light = {
  text: '#142B4D',
  tint: '#1C5A96',

  // Creme do fundo do logo (o emblema em PNG usa exatamente este tom).
  background: '#FCF8F0',
  foreground: '#142B4D',

  card: '#FFFFFF',
  cardForeground: '#142B4D',

  // Azul do escudo: ação (botão, link, foco, item ativo).
  primary: '#1C5A96',
  primaryForeground: '#FFFFFF',

  secondary: '#E7F1FA',
  secondaryForeground: '#174A7E',

  muted: '#F3EDE2',
  mutedForeground: '#56657A',

  // Laranja da família: assinatura (selo, destaque, linha de limite). Versão escura para texto.
  accent: '#A14912',
  accentForeground: '#FFFFFF',

  destructive: '#B8322F',
  destructiveForeground: '#FFFFFF',

  border: '#E9E1D3',
  input: '#D8CDBB',

  success: '#1D7A52',
  successSoft: '#E0F2E8',
  warning: '#855700',
  warningSoft: '#FFF1D6',
  dangerSoft: '#FBE5E2',

  chartGrid: '#E9E1D3',
  chartBar: '#1C5A96',
  chartBarMuted: '#B9D5EE',
  chartLimit: '#E8843F',
  chartHeatLow: '#EEF4FA',
  chartHeatHigh: '#15457A',

  // Superfícies da marca (fundo de ícone, bolha, selo) — nunca texto.
  navy: '#15457A',
  orange: '#F6A46E',
  blueSoft: '#E3EFFA',
  peachSoft: '#FDEBDD',
  mintSoft: '#E0F2E8',
  sunSoft: '#FFF1D2',
  // Fundo: creme do logo, com um sopro de azul só no pé.
  bgTop: '#FDFAF4',
  bgMid: '#FCF8F0',
  bgBottom: '#EEF4FA',
  shadow: '#1C3A5E',
  // O emblema tem fundo creme: no escuro ele fica sobre uma placa creme.
  emblemPlate: 'transparent',
  // Vitrine onde o emblema aparece grande: mesmo creme do fundo do emblema (ele se funde).
  stage: '#FCF8F0',
};

const dark: typeof light = {
  text: '#EAF1F9',
  tint: '#7DB6EC',

  background: '#0C1A2E',
  foreground: '#EAF1F9',

  card: '#13243D',
  cardForeground: '#EAF1F9',

  primary: '#7DB6EC',
  primaryForeground: '#0A1B30',

  secondary: '#18335A',
  secondaryForeground: '#CFE3F7',

  muted: '#172B47',
  mutedForeground: '#9FB1C8',

  accent: '#F6A46E',
  accentForeground: '#2B1405',

  destructive: '#F08A83',
  destructiveForeground: '#2A0A08',

  border: '#223A5C',
  input: '#2C4870',

  success: '#72D3A4',
  successSoft: '#12302A',
  warning: '#F5C46A',
  warningSoft: '#33280F',
  dangerSoft: '#3A1A1C',

  chartGrid: '#223A5C',
  chartBar: '#7DB6EC',
  chartBarMuted: '#24466E',
  chartLimit: '#F6A46E',
  chartHeatLow: '#132640',
  chartHeatHigh: '#9CCBF3',

  navy: '#9CCBF3',
  orange: '#F6A46E',
  blueSoft: '#1B3A63',
  peachSoft: '#3A2618',
  mintSoft: '#12302A',
  sunSoft: '#33290F',
  bgTop: '#0C1A2E',
  bgMid: '#0D1C31',
  bgBottom: '#12233D',
  shadow: '#000000',
  emblemPlate: '#FCF8F0',
  stage: '#13243D',
};

const colors = {
  light,
  dark,
  radius: 20,
};

export type Palette = typeof light;
export default colors;
