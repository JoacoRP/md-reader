import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useSettings, resolveMermaidTheme } from '../../store/settingsStore';
import { attachCopyButtons, renderMermaidIn, toSafeHtml } from '../../lib/markdown';
import { MOCK_MD } from '../../lib/mockMd';

// Preview en vivo de Settings: re-renderiza el mock cuando cambia cualquier
// ajuste (los colores/medidas aplican por variables CSS sin re-render, pero el
// tema de Mermaid/código sí requiere volver a dibujar).
export default function PreviewPanel() {
  const settings = useSettings((s) => s.settings);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = toSafeHtml(MOCK_MD);
    attachCopyButtons(el);
    renderMermaidIn(el, resolveMermaidTheme(settings));
  }, [settings]);

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'var(--md-bg-color)' }}>
      <Box
        className="no-print"
        sx={{
          fontSize: 12,
          color: 'text.secondary',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        Vista previa en vivo — los cambios se aplican y guardan automáticamente.
      </Box>
      <Box ref={ref} className="markdown-body" />
    </Box>
  );
}
