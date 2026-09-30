/**
 * Todo link externo (familia-segura://…, notificações, OAuth) passa aqui antes do roteador.
 * O decodificador de URL usado pelo expo-router (decode-uri-component < 0.5) trava com percent-encoding
 * malformado e gigante (GHSA-vcc3-ghjq-m6fr). Link inválido ou longo demais vai para o início.
 */
const MAX_LINK_LENGTH = 2048;

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (!path || path.length > MAX_LINK_LENGTH) return '/';
    decodeURIComponent(path);
    return path;
  } catch {
    return '/';
  }
}
