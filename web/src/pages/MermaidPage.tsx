import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useSearchParams } from 'react-router-dom';
import mermaid from 'mermaid';
import { api, type AppId } from '../api/client';
import { useSettings, resolveMermaidTheme } from '../store/settingsStore';
import { toSafeHtml } from '../lib/markdown';
import { attachPanZoom, unlockSvgSize, type PanZoomHandle } from '../lib/panzoom';

// Pestaña dedicada a un diagrama: /mermaid?path=<archivo>&i=<indice>&app=<sub-app>.
// Se identifica por posición en el documento en vez de mandar el diagrama en la
// URL, así el link es corto, se puede recargar y compartir.
export default function MermaidPage() {
  const [params] = useSearchParams();
  const settings = useSettings((s) => s.settings);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pzRef = useRef<PanZoomHandle | null>(null);
  const [error, setError] = useState('');

  const path = params.get('path') || '';
  const index = Number(params.get('i') || 0);
  const app = (params.get('app') === 'notes' ? 'notes' : 'reader') as AppId;
  const name = path.split('/').pop() || path;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const viewport = viewportRef.current;
      const canvas = canvasRef.current;
      if (!viewport || !canvas) return;
      if (!path) {
        setError('Falta indicar el archivo en la URL.');
        return;
      }

      try {
        const file = await api.getFile(path, app);
        if (cancelled) return;

        // Reusa el mismo pipeline que el documento, así el índice del diagrama
        // coincide exactamente con el que numeró el renderer.
        const holder = document.createElement('div');
        holder.innerHTML = toSafeHtml(file.content);
        const block = holder.querySelector<HTMLElement>(`#mermaid-${index}`);
        const code = decodeURIComponent(block?.getAttribute('data-mermaid') || '');
        if (!code) {
          setError('No se encontró el diagrama en ese documento. Puede que el archivo haya cambiado.');
          return;
        }

        mermaid.initialize({
          startOnLoad: false,
          theme: (resolveMermaidTheme(settings) as 'default') || 'default',
          securityLevel: 'loose',
        });
        const { svg } = await mermaid.render('mmd-page-' + index, code);
        if (cancelled) return;

        canvas.innerHTML = svg;
        const el = canvas.querySelector('svg');
        if (el) unlockSvgSize(el);

        pzRef.current?.destroy();
        // Sin página que scrollear detrás, acá la rueda hace zoom directo.
        pzRef.current = attachPanZoom(viewport, canvas, { wheelNeedsModifier: false });
        requestAnimationFrame(() => pzRef.current?.fit());
        setError('');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo abrir el diagrama.');
      }
    })();

    return () => {
      cancelled = true;
      pzRef.current?.destroy();
      pzRef.current = null;
    };
  }, [path, index, app, settings]);

  useEffect(() => {
    document.title = error ? 'Diagrama' : `${name} — diagrama ${index + 1}`;
  }, [name, index, error]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.25,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <AccountTreeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 15 }} noWrap title={path}>
          {name}
          <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 1, fontSize: 13 }}>
            diagrama {index + 1}
          </Typography>
        </Typography>
        <Tooltip title="Alejar">
          <IconButton size="small" onClick={() => pzRef.current?.zoomOut()}>
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Acercar">
          <IconButton size="small" onClick={() => pzRef.current?.zoomIn()}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Ajustar a la ventana (doble clic)">
          <IconButton size="small" onClick={() => pzRef.current?.fit()}>
            <FitScreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {error ? (
        <Box sx={{ p: 3, color: 'error.main' }}>{error}</Box>
      ) : (
        <Box
          ref={viewportRef}
          className="mermaid-viewport mermaid-viewport--page"
          title="Arrastrá para mover · rueda para zoom · doble clic para ajustar"
          sx={{ flex: 1, minHeight: 0 }}
        >
          <div ref={canvasRef} className="mermaid-canvas" />
        </Box>
      )}
    </Box>
  );
}
