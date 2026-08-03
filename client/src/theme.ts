import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface PaletteColor {
    '50': string;
  }
  interface SimplePaletteColorOptions {
    '50'?: string;
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#16a34a',
      light: '#4ade80',
      dark: '#15803d',
      contrastText: '#ffffff',
      '50': '#f0fdf4',
    },
    secondary: {
      main: '#ea580c',
      light: '#fb923c',
      dark: '#c2410c',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
  },
  shape: {
    borderRadius: 10,
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0,0,0,0.05)',
    '0 1px 4px 0 rgba(0,0,0,0.07)',
    '0 2px 8px 0 rgba(0,0,0,0.08)',
    '0 4px 12px 0 rgba(0,0,0,0.08)',
    '0 4px 16px 0 rgba(0,0,0,0.10)',
    '0 6px 20px 0 rgba(0,0,0,0.10)',
    '0 8px 24px 0 rgba(0,0,0,0.10)',
    '0 8px 32px 0 rgba(0,0,0,0.12)',
    '0 12px 40px 0 rgba(0,0,0,0.12)',
    '0 16px 48px 0 rgba(0,0,0,0.14)',
    '0 20px 56px 0 rgba(0,0,0,0.14)',
    '0 24px 64px 0 rgba(0,0,0,0.16)',
    '0 28px 72px 0 rgba(0,0,0,0.16)',
    '0 32px 80px 0 rgba(0,0,0,0.18)',
    '0 36px 88px 0 rgba(0,0,0,0.18)',
    '0 40px 96px 0 rgba(0,0,0,0.20)',
    '0 44px 104px 0 rgba(0,0,0,0.20)',
    '0 48px 112px 0 rgba(0,0,0,0.22)',
    '0 52px 120px 0 rgba(0,0,0,0.22)',
    '0 56px 128px 0 rgba(0,0,0,0.24)',
    '0 60px 136px 0 rgba(0,0,0,0.24)',
    '0 64px 144px 0 rgba(0,0,0,0.26)',
    '0 68px 152px 0 rgba(0,0,0,0.26)',
    '0 72px 160px 0 rgba(0,0,0,0.28)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          transition: 'all 0.18s ease',
        },
        contained: {
          boxShadow: '0 1px 4px 0 rgba(0,0,0,0.10)',
          '&:hover': {
            boxShadow: '0 4px 12px 0 rgba(22,163,74,0.30)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
            boxShadow: '0 1px 4px 0 rgba(0,0,0,0.10)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px 0 rgba(0,0,0,0.07)',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 8px 24px 0 rgba(0,0,0,0.10)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 6,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 0 0 #e2e8f0',
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255,255,255,0.92)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'background-color 0.15s ease',
        },
      },
    },
  },
});

export default theme;
