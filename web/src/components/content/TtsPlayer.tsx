import { Box, Fade, IconButton, LinearProgress, Paper, Tooltip, Typography } from '@mui/material';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { useTts } from '../../store/ttsStore';

// Barra flotante de reproducción del modo lector. Anclada abajo del área de
// contenido mientras hay una lectura activa (playing/paused). Los selectores de
// voz y velocidad se suman en la Fase 4.
export default function TtsPlayer() {
  const status = useTts((s) => s.status);
  const index = useTts((s) => s.index);
  const total = useTts((s) => s.total);
  const toggle = useTts((s) => s.toggle);
  const stop = useTts((s) => s.stop);
  const next = useTts((s) => s.next);
  const prev = useTts((s) => s.prev);

  const active = status !== 'idle';
  const playing = status === 'playing';
  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <Fade in={active} unmountOnExit>
      <Paper
        elevation={6}
        className="no-print"
        sx={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: 999,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Tooltip title="Oración anterior">
          <span>
            <IconButton size="small" onClick={prev} disabled={index <= 0}>
              <SkipPreviousIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={playing ? 'Pausar' : 'Reproducir'}>
          <IconButton onClick={toggle} sx={{ color: 'primary.main' }}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Oración siguiente">
          <span>
            <IconButton size="small" onClick={next} disabled={total === 0 || index >= total - 1}>
              <SkipNextIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Detener">
          <IconButton size="small" onClick={stop}>
            <StopIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 116, px: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center', lineHeight: 1 }}>
            {Math.min(index + 1, total)} / {total}
          </Typography>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 4, borderRadius: 2 }} />
        </Box>
      </Paper>
    </Fade>
  );
}
