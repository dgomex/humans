import { useColorScheme } from 'react-native';

import { darkColors, lightColors, storyGradient, type ColorTokens } from './colors';
import { hairline, radius, spacing } from './spacing';
import { typography } from './typography';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  hairline: number;
  storyGradient: typeof storyGradient;
};

const base = { spacing, radius, typography, hairline, storyGradient };

export const lightTheme: Theme = { scheme: 'light', colors: lightColors, ...base };
export const darkTheme: Theme = { scheme: 'dark', colors: darkColors, ...base };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export { spacing, radius, typography, hairline, storyGradient };
export type { ColorTokens };
export type { TypographyVariant } from './typography';
