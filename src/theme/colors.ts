export const colors = {
  background: '#FBF8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F4EEEA',
  coral: '#E97869',
  coralDark: '#C85E55',
  coralSoft: '#FBE2DC',
  navy: '#172535',
  navyMuted: '#596575',
  inkSoft: '#78818C',
  border: '#EDE5DF',
  success: '#4E9A76',
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;
