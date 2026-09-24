import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

/** Tokens de cor do tema atual (claro/escuro, segue o aparelho) + raio padrão. */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
