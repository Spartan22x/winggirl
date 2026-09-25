import { Platform } from 'react-native';
import { colors } from './colors';

export { colors };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontFamily: Platform.select({ web: 'Avenir Next, Avenir, sans-serif', default: 'Avenir Next' }),
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700' as const,
    color: colors.navy,
  },
  title: {
    fontFamily: Platform.select({ web: 'Avenir Next, Avenir, sans-serif', default: 'Avenir Next' }),
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    color: colors.navy,
  },
  body: {
    fontFamily: Platform.select({ web: 'Avenir Next, Avenir, sans-serif', default: 'Avenir Next' }),
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    color: colors.navyMuted,
  },
  label: {
    fontFamily: Platform.select({ web: 'Avenir Next, Avenir, sans-serif', default: 'Avenir Next' }),
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    color: colors.navyMuted,
    letterSpacing: 0.4,
  },
} as const;
