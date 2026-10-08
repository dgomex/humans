/**
 * Color tokens. Components must read colors through `useTheme()` — never hard-code hex values.
 * Values approximate Instagram's current light/dark palettes.
 */
const palette = {
  white: '#FFFFFF',
  black: '#000000',
  blue: '#0095F6',
  blueDark: '#1877F2',
  red: '#FF3040',
  green: '#1CD14F',
} as const;

export const lightColors = {
  background: palette.white,
  backgroundElevated: palette.white,
  backgroundSecondary: '#EFEFEF',
  backgroundPressed: '#DBDBDB',
  text: '#0C1014',
  textSecondary: '#737373',
  textTertiary: '#A8A8A8',
  textInverse: palette.white,
  link: '#00376B',
  separator: '#DBDBDB',
  icon: '#0C1014',
  primary: palette.blue,
  onPrimary: palette.white,
  primaryPressed: '#1877F2',
  danger: palette.red,
  like: palette.red,
  closeFriends: palette.green,
  storySeenRing: '#C7C7C7',
  success: palette.green,
  overlay: 'rgba(0,0,0,0.4)',
  toastBackground: '#262626',
  toastText: palette.white,
  skeleton: '#EFEFEF',
  // Over photos/videos (same in both modes): icons, crop grid, tag bubbles, badges.
  onMedia: palette.white,
  mediaGrid: 'rgba(255,255,255,0.7)',
  mediaScrim: 'rgba(0,0,0,0.6)',
  mediaBackground: palette.black,
} as const;

export type ColorTokens = { [K in keyof typeof lightColors]: string };

export const darkColors: ColorTokens = {
  background: palette.black,
  backgroundElevated: '#262626',
  backgroundSecondary: '#363636',
  backgroundPressed: '#4A4A4A',
  text: '#F5F5F5',
  textSecondary: '#A8A8A8',
  textTertiary: '#737373',
  textInverse: palette.black,
  link: '#E0F1FF',
  separator: '#262626',
  icon: '#F5F5F5',
  primary: palette.blue,
  onPrimary: palette.white,
  primaryPressed: '#1877F2',
  danger: palette.red,
  like: palette.red,
  closeFriends: palette.green,
  storySeenRing: '#4A4A4A',
  success: palette.green,
  overlay: 'rgba(0,0,0,0.6)',
  toastBackground: '#F5F5F5',
  toastText: palette.black,
  skeleton: '#262626',
  onMedia: palette.white,
  mediaGrid: 'rgba(255,255,255,0.7)',
  mediaScrim: 'rgba(0,0,0,0.6)',
  mediaBackground: palette.black,
};

/** Unread-story ring gradient (top-right → bottom-left). Same in both modes. */
export const storyGradient = ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'] as const;
