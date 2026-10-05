import type { TextStyle } from 'react-native';

/**
 * Instagram renders with the platform system font (SF Pro on iOS, Roboto on Android),
 * so no custom font family is loaded; only sizes/weights are tokenized.
 */
export const typography = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  headline: { fontSize: 20, lineHeight: 25, fontWeight: '700' },
  subhead: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 18, fontWeight: '400' },
  bodyBold: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  captionBold: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  tiny: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
