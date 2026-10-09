/**
 * ERCS Mobile Design System — White + Medical Blue + Subtle Green
 */
export const Colors = {
  primaryBlue: '#2563EB',
  darkNavy: '#16324F',
  medicalGreen: '#16A34A',
  lightBlue: '#EFF6FF',
  lightGreen: '#F0FDF4',
  mainBackground: '#F8FAFC',
  cardBackground: '#FFFFFF',
  primaryText: '#1E293B',
  secondaryText: '#64748B',
  borders: '#E2E8F0',
  error: '#DC2626',
  errorLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  info: '#0284C7',
  infoLight: '#F0F9FF',

  // Interactive states
  buttonPrimaryHover: '#1D4ED8',
  buttonPrimaryActive: '#1E40AF',
  disabledBackground: '#F1F5F9',
  disabledText: '#94A3B8',
  overlay: 'rgba(15, 23, 42, 0.5)',
} as const;

export type ColorKeys = keyof typeof Colors;
