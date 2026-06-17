import { createTheme, type Theme } from '@mui/material';
// highlight.js: importamos ambos temas como string y swapeamos el activo.
import githubLight from 'highlight.js/styles/github.css?inline';
import githubDark from 'highlight.js/styles/github-dark.css?inline';
import { resolveFontFamily, type Settings } from './store/settingsStore';

// Paleta del "chrome" de la app (independiente del estilo del documento).
// Mismos valores que las vars --ui-* de variables.css, para que los componentes
// MUI combinen con el resto del UI.
const UI = {
  light: { bg: '#f6f8fa', panel: '#ffffff', border: '#d0d7de', text: '#1f2328', muted: '#656d76' },
  dark: { bg: '#0d1117', panel: '#161b22', border: '#30363d', text: '#e6edf3', muted: '#8b949e' },
};

/** Vuelca la configuración a variables CSS sobre :root (espejo de MDConfig.apply). */
export function applyDocumentVars(s: Settings): void {
  const r = document.documentElement.style;
  r.setProperty('--md-font-family', resolveFontFamily(s.fontFamily));
  r.setProperty('--md-font-size', s.fontSize + 'px');
  r.setProperty('--md-line-height', String(s.lineHeight));
  r.setProperty('--md-letter-spacing', s.letterSpacing + 'px');
  r.setProperty('--md-content-width', s.contentWidth + 'px');
  r.setProperty('--md-para-spacing', s.paragraphSpacing + 'em');
  r.setProperty('--md-text-align', s.justify ? 'justify' : 'left');
  r.setProperty('--md-text-color', s.textColor);
  r.setProperty('--md-bg-color', s.bgColor);
  r.setProperty('--md-accent-color', s.accentColor);
  r.setProperty('--md-heading-color', s.headingColor);
  r.setProperty('--md-link-color', s.linkColor);
  r.setProperty('--md-link-underline', s.linkUnderline === 'always' ? 'underline' : 'none');
  r.setProperty('--md-link-underline-hover', s.linkUnderline === 'none' ? 'none' : 'underline');
  r.setProperty('--md-code-font-size', s.codeFontSize + 'px');
  document.documentElement.setAttribute('data-theme', s.theme);

  applyHljsTheme(s.codeTheme === 'dark' || (s.codeTheme === 'auto' && s.theme === 'dark'));
}

// Inyecta/actualiza el <style> con el tema de highlight.js activo.
let hljsStyleEl: HTMLStyleElement | null = null;
function applyHljsTheme(dark: boolean): void {
  if (!hljsStyleEl) {
    hljsStyleEl = document.createElement('style');
    hljsStyleEl.id = 'hljs-theme';
    document.head.appendChild(hljsStyleEl);
  }
  hljsStyleEl.textContent = dark ? githubDark : githubLight;
}

/** Construye el theme de MUI a partir de la configuración del usuario. */
export function buildMuiTheme(s: Settings): Theme {
  const ui = UI[s.theme];
  return createTheme({
    palette: {
      mode: s.theme,
      primary: { main: s.accentColor },
      background: { default: ui.bg, paper: ui.panel },
      divider: ui.border,
      text: { primary: ui.text, secondary: ui.muted },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    },
    components: {
      MuiTooltip: {
        defaultProps: { arrow: true },
      },
    },
  });
}
