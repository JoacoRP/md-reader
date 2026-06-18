import { useEffect, useMemo, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useSettings } from '../store/settingsStore';
import { applyDocumentVars, buildMuiTheme } from '../theme';

// Puente entre el settingsStore y el documento + MUI: cada cambio de settings
// vuelca las variables CSS (--md-*, data-theme, tema de hljs) y reconstruye el
// theme de MUI para que los componentes acompañen el modo claro/oscuro y el acento.
export default function ThemeBridge({ children }: { children: ReactNode }) {
  const settings = useSettings((s) => s.settings);

  useEffect(() => {
    applyDocumentVars(settings);
  }, [settings]);

  const theme = useMemo(() => buildMuiTheme(settings), [settings]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
