/**
 * Catálogo curado de apps populares no Brasil entre crianças e adolescentes.
 * `androidPackages` é o que o Android usa para bloquear/medir. No iOS a associação
 * é feita no aparelho pelo seletor da Apple (os tokens não saem do aparelho).
 * `icon` é um nome do conjunto Feather usado no app.
 */
export type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  icon: string;
  iconColor: string;
  androidPackages: string[];
};

export const GLOBAL_CATALOG: CatalogEntry[] = [
  { id: "youtube", name: "YouTube", category: "Vídeo", icon: "youtube", iconColor: "#FF0000", androidPackages: ["com.google.android.youtube"] },
  { id: "youtube-kids", name: "YouTube Kids", category: "Vídeo", icon: "youtube", iconColor: "#FF4E45", androidPackages: ["com.google.android.apps.youtube.kids"] },
  { id: "tiktok", name: "TikTok", category: "Redes sociais", icon: "music", iconColor: "#111111", androidPackages: ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill"] },
  { id: "kwai", name: "Kwai", category: "Redes sociais", icon: "video", iconColor: "#FF7E00", androidPackages: ["com.kwai.video"] },
  { id: "instagram", name: "Instagram", category: "Redes sociais", icon: "instagram", iconColor: "#E1306C", androidPackages: ["com.instagram.android"] },
  { id: "facebook", name: "Facebook", category: "Redes sociais", icon: "facebook", iconColor: "#1877F2", androidPackages: ["com.facebook.katana", "com.facebook.lite"] },
  { id: "x", name: "X (Twitter)", category: "Redes sociais", icon: "twitter", iconColor: "#111111", androidPackages: ["com.twitter.android"] },
  { id: "snapchat", name: "Snapchat", category: "Redes sociais", icon: "camera", iconColor: "#E5C700", androidPackages: ["com.snapchat.android"] },
  { id: "pinterest", name: "Pinterest", category: "Redes sociais", icon: "image", iconColor: "#E60023", androidPackages: ["com.pinterest"] },
  { id: "whatsapp", name: "WhatsApp", category: "Mensagens", icon: "message-circle", iconColor: "#25D366", androidPackages: ["com.whatsapp", "com.whatsapp.w4b"] },
  { id: "telegram", name: "Telegram", category: "Mensagens", icon: "send", iconColor: "#229ED9", androidPackages: ["org.telegram.messenger"] },
  { id: "messenger", name: "Messenger", category: "Mensagens", icon: "message-square", iconColor: "#0084FF", androidPackages: ["com.facebook.orca"] },
  { id: "discord", name: "Discord", category: "Mensagens", icon: "headphones", iconColor: "#5865F2", androidPackages: ["com.discord"] },
  { id: "roblox", name: "Roblox", category: "Jogos", icon: "box", iconColor: "#E2231A", androidPackages: ["com.roblox.client"] },
  { id: "minecraft", name: "Minecraft", category: "Jogos", icon: "grid", iconColor: "#62B47A", androidPackages: ["com.mojang.minecraftpe"] },
  { id: "free-fire", name: "Free Fire", category: "Jogos", icon: "crosshair", iconColor: "#F2A900", androidPackages: ["com.dts.freefireth", "com.dts.freefiremax"] },
  { id: "fortnite", name: "Fortnite", category: "Jogos", icon: "zap", iconColor: "#7B61FF", androidPackages: ["com.epicgames.fortnite"] },
  { id: "brawl-stars", name: "Brawl Stars", category: "Jogos", icon: "star", iconColor: "#FFB800", androidPackages: ["com.supercell.brawlstars"] },
  { id: "clash-royale", name: "Clash Royale", category: "Jogos", icon: "shield", iconColor: "#2E6FD8", androidPackages: ["com.supercell.clashroyale"] },
  { id: "stumble-guys", name: "Stumble Guys", category: "Jogos", icon: "smile", iconColor: "#FF5A1F", androidPackages: ["com.kitkagames.fallbuddies"] },
  { id: "subway-surfers", name: "Subway Surfers", category: "Jogos", icon: "trending-up", iconColor: "#F9A602", androidPackages: ["com.kiloo.subwaysurf"] },
  { id: "among-us", name: "Among Us", category: "Jogos", icon: "user", iconColor: "#C51111", androidPackages: ["com.innersloth.spacemafia"] },
  { id: "pubg-mobile", name: "PUBG Mobile", category: "Jogos", icon: "target", iconColor: "#F4B400", androidPackages: ["com.tencent.ig"] },
  { id: "netflix", name: "Netflix", category: "Streaming", icon: "film", iconColor: "#E50914", androidPackages: ["com.netflix.mediaclient"] },
  { id: "disney-plus", name: "Disney+", category: "Streaming", icon: "film", iconColor: "#113CCF", androidPackages: ["com.disney.disneyplus"] },
  { id: "prime-video", name: "Prime Video", category: "Streaming", icon: "film", iconColor: "#00A8E1", androidPackages: ["com.amazon.avod.thirdpartyclient"] },
  { id: "globoplay", name: "Globoplay", category: "Streaming", icon: "tv", iconColor: "#FB0234", androidPackages: ["com.globo.globotv"] },
  { id: "twitch", name: "Twitch", category: "Streaming", icon: "twitch", iconColor: "#9146FF", androidPackages: ["tv.twitch.android.app"] },
  { id: "spotify", name: "Spotify", category: "Música", icon: "headphones", iconColor: "#1DB954", androidPackages: ["com.spotify.music"] },
  { id: "chrome", name: "Google Chrome", category: "Navegação", icon: "chrome", iconColor: "#4285F4", androidPackages: ["com.android.chrome"] },
  { id: "play-store", name: "Google Play Store", category: "Loja de apps", icon: "shopping-bag", iconColor: "#01875F", androidPackages: ["com.android.vending"] },
  { id: "chatgpt", name: "ChatGPT", category: "Inteligência artificial", icon: "cpu", iconColor: "#10A37F", androidPackages: ["com.openai.chatgpt"] },
  { id: "duolingo", name: "Duolingo", category: "Educação", icon: "book-open", iconColor: "#58CC02", androidPackages: ["com.duolingo"] },
  { id: "khan-academy", name: "Khan Academy", category: "Educação", icon: "book", iconColor: "#14BF96", androidPackages: ["org.khanacademy.android"] },
];

const byId = new Map(GLOBAL_CATALOG.map((entry) => [entry.id, entry]));
const byPackage = new Map(GLOBAL_CATALOG.flatMap((entry) => entry.androidPackages.map((pkg) => [pkg, entry] as const)));

export const findCatalogEntry = (id: string) => byId.get(id);
export const findCatalogEntryByPackage = (pkg: string) => byPackage.get(pkg);
