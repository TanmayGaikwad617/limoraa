export const theme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    card: '#FFFFFF',
    text: '#000000',
    secondary: '#666666',
    tertiary: '#999999',
    border: '#E5E5E5',
    divider: '#EBEBEB',
    skeleton: '#F0F0F0',
    overlay: 'rgba(0,0,0,0.04)',
    black: '#000000',
    white: '#FFFFFF',
    danger: '#FF3B30',
    muted: '#666666',
    cardSoft: '#F5F5F5',
    accent: '#007AFF',
    rust: '#8B4513',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  },
  typography: {
    largeTitle: {
      fontSize: 28,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    title: {
      fontSize: 20,
      fontWeight: '700' as const,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
    },
    body: {
      fontSize: 12,
      fontWeight: '400' as const,
    },
    micro: {
      fontSize: 11,
      fontWeight: '500' as const,
    },
  },
};
