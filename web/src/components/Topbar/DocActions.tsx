import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import ArticleIcon from '@mui/icons-material/Article';
import ListAltIcon from '@mui/icons-material/ListAlt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import EditIcon from '@mui/icons-material/Edit';
import SyncIcon from '@mui/icons-material/Sync';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { mockUrl } from '../../api/client';
import { useApp } from '../../store/appStore';
import { useUi } from '../../store/uiStore';
import { useTts } from '../../store/ttsStore';
import { formatMeta } from '../../lib/format';

const SAVE_UI: Record<string, { icon: React.ReactNode; text: string; color: string } | null> = {
  hidden: null,
  clean: null,
  dirty: { icon: <EditIcon sx={{ fontSize: 14 }} />, text: 'sin guardar', color: 'text.secondary' },
  saving: { icon: <SyncIcon sx={{ fontSize: 14 }} />, text: 'guardando…', color: 'text.secondary' },
  saved: { icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, text: 'guardado', color: 'success.main' },
  error: { icon: <ErrorIcon sx={{ fontSize: 14 }} />, text: 'error al guardar', color: 'error.main' },
};

export default function DocActions() {
  const currentPath = useApp((s) => s.currentPath);
  const currentKind = useApp((s) => s.currentKind);
  const currentContent = useApp((s) => s.currentContent);
  const currentMtime = useApp((s) => s.currentMtime);
  const rawMode = useApp((s) => s.rawMode);
  const forceEditOnce = useApp((s) => s.forceEditOnce);
  const saveStatus = useApp((s) => s.saveStatus);
  const toggleRaw = useApp((s) => s.toggleRaw);
  const toggleToc = useUi((s) => s.toggleToc);
  const tocOpen = useUi((s) => s.tocOpen);
  const ttsAvailable = useTts((s) => s.available);
  const ttsStatus = useTts((s) => s.status);
  const ttsToggle = useTts((s) => s.toggle);
  const ttsStop = useTts((s) => s.stop);

  if (!currentPath) return null;

  const isTxt = currentKind === 'txt';
  const editing = rawMode || isTxt || forceEditOnce;
  const isMock = currentKind === 'html' && !editing;
  const save = SAVE_UI[saveStatus];
  // Modo lector: sólo sobre Markdown formateado (hay DOM y contenido cargado).
  const canRead = ttsAvailable && !editing && !isMock && !isTxt && currentContent != null;
  const ttsTitle =
    ttsStatus === 'playing' ? 'Pausar lectura' : ttsStatus === 'paused' ? 'Reanudar lectura' : 'Escuchar documento';

  let meta = '';
  if (isMock) meta = 'Mock HTML';
  else if (currentContent != null) {
    meta = formatMeta(currentContent, currentMtime);
    if (currentKind === 'html') meta += ' · Mock HTML · editando';
    else if (isTxt) meta += ' · texto plano';
    else if (editing) meta += ' · editando';
  }

  return (
    <>
      {save && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11, color: save.color, mr: 0.5 }}>
          {save.icon}
          {save.text}
        </Box>
      )}
      {meta && (
        <Typography sx={{ fontSize: 11, color: isMock ? '#e44d26' : 'text.secondary', mr: 0.5, fontWeight: isMock ? 600 : 400 }}>
          {meta}
        </Typography>
      )}

      {isMock && (
        <Tooltip title="Abrir mock en pestaña nueva">
          <IconButton size="small" component="a" href={mockUrl(currentPath)} target="_blank" rel="noopener">
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {canRead && (
        <Tooltip title={ttsTitle}>
          <IconButton
            size="small"
            onClick={ttsToggle}
            sx={ttsStatus !== 'idle' ? { color: 'primary.main', bgcolor: 'var(--ui-active)' } : undefined}
          >
            {ttsStatus === 'playing' ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
      {canRead && ttsStatus !== 'idle' && (
        <Tooltip title="Detener lectura">
          <IconButton size="small" onClick={ttsStop}>
            <StopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {!isTxt && (
        <Tooltip title={editing ? 'Ver formateado' : 'Ver original (raw)'}>
          <IconButton
            size="small"
            onClick={toggleRaw}
            sx={editing ? { color: 'primary.main', bgcolor: 'var(--ui-active)' } : undefined}
          >
            {editing ? <ArticleIcon fontSize="small" /> : <CodeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title="Tabla de contenidos">
        <IconButton size="small" onClick={toggleToc} sx={tocOpen ? { color: 'primary.main' } : undefined}>
          <ListAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );
}
