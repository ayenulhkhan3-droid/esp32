export const colors = {
  background: '#FFFFFF',
  surface: '#F5F8FF',
  card: '#FFFFFF',
  border: '#E3EAF7',
  primary: '#1E6BFF',
  primaryDark: '#1450C8',
  primarySoft: '#E8F0FF',
  text: '#0F1B33',
  textMuted: '#5D6B85',
  textFaint: '#94A1B8',
  success: '#12A150',
  successSoft: '#E6F7EE',
  warning: '#D98A00',
  warningSoft: '#FFF5E0',
  danger: '#E5243B',
  dangerDark: '#B5172A',
  dangerSoft: '#FDECEE',
  white: '#FFFFFF',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;
