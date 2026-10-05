import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme';

type IonName = ComponentProps<typeof Ionicons>['name'];
type McName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Glyph = { set: 'ion'; name: IonName } | { set: 'mc'; name: McName };

/**
 * Semantic icon registry. Screens use these names, never glyph names directly, so a glyph can be
 * swapped (e.g. for a custom SVG) in one place. Pairs ending in `Filled` are the active state.
 */
const glyphs = {
  home: { set: 'ion', name: 'home-outline' },
  homeFilled: { set: 'ion', name: 'home' },
  search: { set: 'ion', name: 'search-outline' },
  searchFilled: { set: 'ion', name: 'search' },
  create: { set: 'mc', name: 'plus-box-outline' },
  createFilled: { set: 'mc', name: 'plus-box' },
  reels: { set: 'ion', name: 'film-outline' },
  reelsFilled: { set: 'ion', name: 'film' },
  profile: { set: 'ion', name: 'person-circle-outline' },
  profileFilled: { set: 'ion', name: 'person-circle' },
  heart: { set: 'ion', name: 'heart-outline' },
  heartFilled: { set: 'ion', name: 'heart' },
  comment: { set: 'ion', name: 'chatbubble-outline' },
  share: { set: 'ion', name: 'paper-plane-outline' },
  messenger: { set: 'mc', name: 'facebook-messenger' },
  bookmark: { set: 'ion', name: 'bookmark-outline' },
  bookmarkFilled: { set: 'ion', name: 'bookmark' },
  more: { set: 'ion', name: 'ellipsis-horizontal' },
  moreVertical: { set: 'ion', name: 'ellipsis-vertical' },
  close: { set: 'ion', name: 'close' },
  back: { set: 'ion', name: 'chevron-back' },
  forward: { set: 'ion', name: 'chevron-forward' },
  down: { set: 'ion', name: 'chevron-down' },
  camera: { set: 'ion', name: 'camera-outline' },
  settings: { set: 'ion', name: 'settings-outline' },
  menu: { set: 'ion', name: 'menu' },
  add: { set: 'ion', name: 'add' },
  check: { set: 'ion', name: 'checkmark' },
  checkCircle: { set: 'ion', name: 'checkmark-circle' },
  alert: { set: 'ion', name: 'alert-circle-outline' },
  lock: { set: 'ion', name: 'lock-closed-outline' },
  person: { set: 'ion', name: 'person' },
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof glyphs;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
};

export function Icon({ name, size = 24, color, accessibilityLabel }: IconProps) {
  const { colors } = useTheme();
  const glyph: Glyph = glyphs[name];
  const shared = {
    size,
    color: color ?? colors.icon,
    accessibilityLabel,
    accessible: !!accessibilityLabel,
  };
  return glyph.set === 'ion' ? (
    <Ionicons name={glyph.name} {...shared} />
  ) : (
    <MaterialCommunityIcons name={glyph.name} {...shared} />
  );
}
