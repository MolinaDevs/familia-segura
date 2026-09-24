/**
 * Tokens de cor do app (claro e escuro). `useColors()` escolhe a paleta pelo tema do aparelho.
 * Não use cores fixas nas telas: acrescente um token aqui.
 */

const light = {
  text: '#2D3748',
  tint: '#2A5A4A',

  background: '#F9F9F7',
  foreground: '#1F2A37',

  card: '#FFFFFF',
  cardForeground: '#1F2A37',

  primary: '#2A5A4A',
  primaryForeground: '#FFFFFF',

  secondary: '#E6EDE9',
  secondaryForeground: '#204538',

  muted: '#F0EFEA',
  mutedForeground: '#66736C',

  accent: '#D97736',
  accentForeground: '#FFFFFF',

  destructive: '#C8443F',
  destructiveForeground: '#FFFFFF',

  border: '#E6E4DF',
  input: '#DAD7D0',

  success: '#2F8A5B',
  successSoft: '#E3F3EA',
  warning: '#A86E12',
  warningSoft: '#FFF3D4',
  dangerSoft: '#FCE7E4',

  chartGrid: '#E6E4DF',
  chartBar: '#2A5A4A',
  chartBarMuted: '#BFD3C9',
  chartLimit: '#D97736',
  chartHeatLow: '#EEF3F0',
  chartHeatHigh: '#1F4A3C',
};

const dark: typeof light = {
  text: '#E6ECE8',
  tint: '#8CC7AE',

  background: '#0F1512',
  foreground: '#E9EEEB',

  card: '#18201C',
  cardForeground: '#E9EEEB',

  primary: '#6FB596',
  primaryForeground: '#0B1410',

  secondary: '#1F2E27',
  secondaryForeground: '#BFE0D1',

  muted: '#1C2420',
  mutedForeground: '#9AA8A1',

  accent: '#E8914F',
  accentForeground: '#1A0F06',

  destructive: '#F07A72',
  destructiveForeground: '#1B0706',

  border: '#26322C',
  input: '#33413A',

  success: '#6FCF9B',
  successSoft: '#17301F',
  warning: '#F1B550',
  warningSoft: '#33280F',
  dangerSoft: '#3A1815',

  chartGrid: '#26322C',
  chartBar: '#6FB596',
  chartBarMuted: '#2E4A3E',
  chartLimit: '#E8914F',
  chartHeatLow: '#1A2420',
  chartHeatHigh: '#8CE0B9',
};

const colors = {
  light,
  dark,
  radius: 22,
};

export type Palette = typeof light;
export default colors;
