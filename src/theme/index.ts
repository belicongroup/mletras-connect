export const colors = {
  background: '#000000',
  surface: '#000000',
  border: '#2F3336',
  text: '#E7E9EA',
  textSecondary: '#71767B',
  primary: '#1D9BF0',
  primaryPressed: '#1A8CD8',
  danger: '#F4212E',
  like: '#F91880',
  placeholder: '#3A3B3C',
  overlay: 'rgba(91, 112, 131, 0.4)',
  drawer: '#16181C',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const typography = {
  title: { fontSize: 31, fontWeight: '700' as const, lineHeight: 36 },
  heading: { fontSize: 20, fontWeight: '700' as const, lineHeight: 24 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  bodyBold: { fontSize: 15, fontWeight: '700' as const, lineHeight: 20 },
  caption: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 16 },
} as const;

export const layout = {
  maxContentWidth: 600,
  avatarSm: 40,
  avatarMd: 48,
  fabSize: 56,
} as const;
