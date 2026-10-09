import { Platform, type TextStyle } from 'react-native';

import type { FontId } from './types';

/**
 * Story-only visual constants. Stories are artwork drawn on top of media, so (like Instagram) they
 * use their own fixed palette instead of the app's light/dark theme tokens.
 */

/** Text / drawing color row (first is white, the default on media). */
export const STORY_COLORS = [
  '#FFFFFF',
  '#000000',
  '#3897F0',
  '#70C050',
  '#FDCB5C',
  '#FD8D32',
  '#ED4956',
  '#D10869',
  '#A307BA',
  '#262626',
  '#C7C7C7',
  '#FFC0CB',
] as const;

/** "Create" (text-only) backgrounds, top → bottom. */
export const STORY_GRADIENTS: [string, string][] = [
  ['#833AB4', '#FD1D1D'],
  ['#405DE6', '#5851DB'],
  ['#F77737', '#FCAF45'],
  ['#0BAB64', '#3BB78F'],
  ['#232526', '#414345'],
  ['#EE9CA7', '#FFDDE1'],
  ['#1A2980', '#26D0CE'],
];

/** Sticker artwork colors (same in light and dark mode, like Instagram's stickers). */
export const STICKER = {
  paper: '#FFFFFF',
  field: '#EFEFEF',
  ink: '#262626',
  muted: '#8E8E8E',
  onMedia: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.45)',
  glass: 'rgba(255,255,255,0.2)',
  accent: '#3897F0',
  accentSoft: '#C9E2FB',
  mention: '#E1306C',
  hashtag: '#F56040',
  link: '#3897F0',
  quiz: '#7232BD',
  correct: '#58C322',
  wrong: '#ED4956',
  sliderFrom: '#FDCB5C',
  sliderTo: '#ED4956',
  countdownFrom: '#7232BD',
  countdownTo: '#E1306C',
  layoutDivider: '#000000',
} as const;

/** Letterbox behind photos / videos that don't fill the screen. */
export const MEDIA_BACKDROP: [string, string] = ['#2B2B2B', '#121212'];

export const FONTS: { id: FontId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'modern', label: 'Modern' },
  { id: 'neon', label: 'Neon' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'strong', label: 'Strong' },
];

/** System font stacks that exist on iOS, Android and web (no bundled fonts). */
export function fontStyle(font: FontId, color: string): TextStyle {
  switch (font) {
    case 'modern':
      return {
        fontFamily: Platform.select({
          ios: 'AvenirNextCondensed-Heavy',
          android: 'sans-serif-condensed',
          default: '"Arial Narrow", Arial, sans-serif',
        }),
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
      };
    case 'neon':
      return {
        fontFamily: Platform.select({
          ios: 'Noteworthy-Bold',
          android: 'casual',
          default: '"Comic Sans MS", cursive',
        }),
        fontWeight: '700',
        textShadowColor: color,
        textShadowRadius: 12,
        textShadowOffset: { width: 0, height: 0 },
      };
    case 'typewriter':
      return {
        fontFamily: Platform.select({
          ios: 'Courier-Bold',
          android: 'monospace',
          default: '"Courier New", monospace',
        }),
        fontWeight: '700',
      };
    case 'strong':
      return { fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase' };
    default:
      return { fontWeight: '700' };
  }
}

/** Readable text color on top of `bg` (for solid text backgrounds and sticker labels). */
export function contrastOn(bg: string): string {
  const hex = bg.replace('#', '');
  if (hex.length !== 6) return '#000000';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#000000' : '#FFFFFF';
}

/** Quick reactions under the reply field (page 52). */
export const QUICK_REACTIONS = ['😂', '😮', '😍', '😢', '👏', '🔥', '🎉', '💯'] as const;

export const SLIDER_EMOJIS = ['😍', '🔥', '😂', '😮', '👏', '💯', '🥺', '🎉'] as const;
