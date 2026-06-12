'use strict';
/* Modelo de configuración compartido entre el lector y la página de settings.
   Centraliza los valores por defecto, presets y la aplicación de variables CSS. */
(function () {
  const VERSION = '1.1.0';
  const STORAGE_KEY = 'md-reader-settings';

  const FONT_FAMILIES = {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
    inter: "'Inter', system-ui, sans-serif",
    georgia: "Georgia, 'Times New Roman', serif",
    mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace"
  };

  const DEFAULTS = {
    // Tipografía
    fontFamily: 'system',
    fontSize: 16,          // px
    lineHeight: 1.7,
    letterSpacing: 0,      // px
    contentWidth: 860,     // px
    paragraphSpacing: 1,   // em (margen inferior de párrafos)
    justify: false,
    // Colores
    textColor: '#1f2328',
    bgColor: '#ffffff',
    accentColor: '#0969da',
    headingColor: '#0969da',
    linkColor: '#0969da',
    linkUnderline: 'hover', // none | hover | always
    // Código y diagramas
    codeFontSize: 13.5,     // px
    codeTheme: 'auto',      // auto | light | dark
    mermaidTheme: 'auto',   // auto | default | neutral | forest | dark
    // General
    theme: 'light'          // light | dark (chrome de la app)
  };

  const PRESETS = {
    default:  { theme: 'light', textColor: '#1f2328', bgColor: '#ffffff', accentColor: '#0969da', headingColor: '#0969da', linkColor: '#0969da' },
    sepia:    { theme: 'light', textColor: '#433422', bgColor: '#f4ecd8', accentColor: '#9a5b2e', headingColor: '#7b4a24', linkColor: '#9a5b2e' },
    night:    { theme: 'dark',  textColor: '#c9d1d9', bgColor: '#0d1117', accentColor: '#58a6ff', headingColor: '#79c0ff', linkColor: '#58a6ff' },
    contrast: { theme: 'light', textColor: '#000000', bgColor: '#ffffff', accentColor: '#0033cc', headingColor: '#000000', linkColor: '#0033cc' }
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...DEFAULTS, ...saved };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }

  function resolveFontFamily(v) { return FONT_FAMILIES[v] || v; }

  // Mermaid no acepta "auto": lo resolvemos según el tema claro/oscuro.
  function resolveMermaidTheme(s) {
    if (s.mermaidTheme && s.mermaidTheme !== 'auto') return s.mermaidTheme;
    return s.theme === 'dark' ? 'dark' : 'default';
  }

  // Vuelca la configuración a variables CSS sobre :root.
  function apply(s) {
    const r = document.documentElement.style;
    r.setProperty('--md-font-family', resolveFontFamily(s.fontFamily));
    r.setProperty('--md-font-size', s.fontSize + 'px');
    r.setProperty('--md-line-height', s.lineHeight);
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
    // Bootstrap 5.3 adapta sus componentes (selects, inputs, cards) con este atributo.
    document.documentElement.setAttribute('data-bs-theme', s.theme);

    // Hoja de estilo de highlight.js según codeTheme (auto sigue al tema).
    const dark = s.codeTheme === 'dark' || (s.codeTheme === 'auto' && s.theme === 'dark');
    const hl = document.getElementById('hljs-light');
    const hd = document.getElementById('hljs-dark');
    if (hl) hl.disabled = dark;
    if (hd) hd.disabled = !dark;

    const tb = document.getElementById('theme-btn');
    if (tb) tb.innerHTML = s.theme === 'dark'
      ? '<i class="bi bi-sun"></i>'
      : '<i class="bi bi-moon-stars"></i>';
  }

  // ---- Presets/temas custom creados por el usuario ----
  const PRESETS_KEY = 'md-reader-presets';
  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
  }
  function savePresets(list) {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch {}
  }

  window.MDConfig = {
    VERSION, STORAGE_KEY, PRESETS_KEY, FONT_FAMILIES, DEFAULTS, PRESETS,
    load, save, apply, resolveFontFamily, resolveMermaidTheme,
    loadPresets, savePresets
  };
})();
