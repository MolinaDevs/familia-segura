import React from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
// Importação por ícone: o pacote inteiro tem mais de mil ícones e pesaria no app.
import { AppWindowIcon } from 'phosphor-react-native/src/icons/AppWindow';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowsClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { BatteryChargingIcon } from 'phosphor-react-native/src/icons/BatteryCharging';
import { BatteryHighIcon } from 'phosphor-react-native/src/icons/BatteryHigh';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BookIcon } from 'phosphor-react-native/src/icons/Book';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
import { ChatCircleIcon } from 'phosphor-react-native/src/icons/ChatCircle';
import { ChatTextIcon } from 'phosphor-react-native/src/icons/ChatText';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { CpuIcon } from 'phosphor-react-native/src/icons/Cpu';
import { CrosshairIcon } from 'phosphor-react-native/src/icons/Crosshair';
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile';
import { DownloadSimpleIcon } from 'phosphor-react-native/src/icons/DownloadSimple';
import { EnvelopeSimpleIcon } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlashIcon } from 'phosphor-react-native/src/icons/EyeSlash';
import { FacebookLogoIcon } from 'phosphor-react-native/src/icons/FacebookLogo';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { FilmStripIcon } from 'phosphor-react-native/src/icons/FilmStrip';
import { GearIcon } from 'phosphor-react-native/src/icons/Gear';
import { GlobeIcon } from 'phosphor-react-native/src/icons/Globe';
import { GoogleChromeLogoIcon } from 'phosphor-react-native/src/icons/GoogleChromeLogo';
import { HashIcon } from 'phosphor-react-native/src/icons/Hash';
import { HeadphonesIcon } from 'phosphor-react-native/src/icons/Headphones';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { InstagramLogoIcon } from 'phosphor-react-native/src/icons/InstagramLogo';
import { KeyIcon } from 'phosphor-react-native/src/icons/Key';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { LinkIcon } from 'phosphor-react-native/src/icons/Link';
import { LockIcon } from 'phosphor-react-native/src/icons/Lock';
import { LockOpenIcon } from 'phosphor-react-native/src/icons/LockOpen';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { MusicNotesIcon } from 'phosphor-react-native/src/icons/MusicNotes';
import { PackageIcon } from 'phosphor-react-native/src/icons/Package';
import { PaperPlaneTiltIcon } from 'phosphor-react-native/src/icons/PaperPlaneTilt';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ProhibitIcon } from 'phosphor-react-native/src/icons/Prohibit';
import { PulseIcon } from 'phosphor-react-native/src/icons/Pulse';
import { QuestionIcon } from 'phosphor-react-native/src/icons/Question';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { ShieldSlashIcon } from 'phosphor-react-native/src/icons/ShieldSlash';
import { ShoppingBagIcon } from 'phosphor-react-native/src/icons/ShoppingBag';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { SmileyIcon } from 'phosphor-react-native/src/icons/Smiley';
import { SquaresFourIcon } from 'phosphor-react-native/src/icons/SquaresFour';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { TargetIcon } from 'phosphor-react-native/src/icons/Target';
import { TelevisionIcon } from 'phosphor-react-native/src/icons/Television';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { TrendUpIcon } from 'phosphor-react-native/src/icons/TrendUp';
import { TwitchLogoIcon } from 'phosphor-react-native/src/icons/TwitchLogo';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UserCheckIcon } from 'phosphor-react-native/src/icons/UserCheck';
import { UserPlusIcon } from 'phosphor-react-native/src/icons/UserPlus';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { VideoCameraIcon } from 'phosphor-react-native/src/icons/VideoCamera';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { XLogoIcon } from 'phosphor-react-native/src/icons/XLogo';
import { YoutubeLogoIcon } from 'phosphor-react-native/src/icons/YoutubeLogo';

/**
 * Ícones do app (Phosphor). Os nomes seguem os que o app e a API já usam (herdados do Feather),
 * então o catálogo de apps do servidor continua funcionando sem migração.
 * Padrão "duotone": o traço em azul com um preenchimento suave, como o escudo do logo.
 */
const ICONS = {
  // navegação e ações
  'arrow-left': ArrowLeftIcon, 'chevron-right': CaretRightIcon, x: XIcon, plus: PlusIcon, check: CheckIcon,
  'trash-2': TrashIcon, 'edit-3': PencilSimpleIcon, 'refresh-cw': ArrowsClockwiseIcon, 'log-out': SignOutIcon,
  'share-2': ShareNetworkIcon, link: LinkIcon, settings: GearIcon, sliders: SlidersHorizontalIcon, download: DownloadSimpleIcon,
  // estados
  circle: CircleIcon, 'check-circle': CheckCircleIcon, 'alert-circle': WarningCircleIcon, 'alert-triangle': WarningIcon, info: InfoIcon,
  'info-circle': InfoIcon, 'help-circle': QuestionIcon, slash: ProhibitIcon, eye: EyeIcon, 'eye-off': EyeSlashIcon,
  // proteção
  shield: ShieldCheckIcon, 'shield-off': ShieldSlashIcon, lock: LockIcon, unlock: LockOpenIcon, key: KeyIcon, hash: HashIcon,
  // pessoas e aparelhos
  users: UsersThreeIcon, user: UserIcon, 'user-plus': UserPlusIcon, 'user-check': UserCheckIcon, smile: SmileyIcon,
  smartphone: DeviceMobileIcon, battery: BatteryHighIcon, 'battery-charging': BatteryChargingIcon, 'wifi-off': WifiSlashIcon,
  cpu: CpuIcon, globe: GlobeIcon, mail: EnvelopeSimpleIcon, bell: BellIcon,
  // abas e relatórios
  home: HouseIcon, house: HouseIcon, grid: SquaresFourIcon, 'bar-chart-2': ChartBarIcon, activity: PulseIcon,
  'file-text': FileTextIcon, 'trending-up': TrendUpIcon,
  // rotinas
  moon: MoonIcon, clock: ClockIcon, book: BookIcon, 'book-open': BookOpenIcon, coffee: CoffeeIcon,
  // categorias do catálogo de apps (vêm do servidor)
  play: PlayIcon, star: StarIcon, box: PackageIcon, camera: CameraIcon, chrome: GoogleChromeLogoIcon, crosshair: CrosshairIcon,
  facebook: FacebookLogoIcon, film: FilmStripIcon, headphones: HeadphonesIcon, image: ImageIcon, instagram: InstagramLogoIcon,
  'message-circle': ChatCircleIcon, 'message-square': ChatTextIcon, music: MusicNotesIcon, send: PaperPlaneTiltIcon,
  'shopping-bag': ShoppingBagIcon, target: TargetIcon, tv: TelevisionIcon, twitch: TwitchLogoIcon, twitter: XLogoIcon,
  video: VideoCameraIcon, youtube: YoutubeLogoIcon, zap: LightningIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

/** Nome vindo do servidor (catálogo de apps, rotinas): desconhecido vira um ícone genérico de app. */
export const iconName = (value: string | null | undefined, fallback: IconName = 'grid'): IconName =>
  value && value in ICONS ? (value as IconName) : fallback;

/** Ícones de controle (setas, fechar, marcar) ficam em traço firme; o resto em duotone. */
const BOLD = new Set<string>(['arrow-left', 'chevron-right', 'x', 'plus', 'check', 'eye', 'eye-off']);

export function Icon({ name, size = 20, color, weight, style, testID }: {
  /** Nome conhecido. Nome vindo do servidor passa por `iconName()`. */
  name: IconName;
  size?: number;
  color?: ColorValue;
  weight?: IconWeight;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const Component: PhosphorIcon = ICONS[name] ?? AppWindowIcon;
  return (
    <Component
      size={size}
      color={color as string | undefined}
      weight={weight ?? (BOLD.has(name) ? 'bold' : 'duotone')}
      duotoneOpacity={0.22}
      style={style}
      testID={testID}
    />
  );
}
