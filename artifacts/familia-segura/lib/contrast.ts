/** Luminância relativa (WCAG) de uma cor #RRGGBB. */
function luminance(hex: string) {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Cor de texto legível sobre um fundo escolhido pelo usuário (ex.: a cor da criança):
 * branco ou tinta-marinho, o que tiver mais contraste.
 */
export function textOn(background: string) {
  return contrast('#FFFFFF', background) >= contrast('#142B4D', background) ? '#FFFFFF' : '#142B4D';
}
