import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Fade,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';
import { useTts } from '../../store/ttsStore';
import { PIPER_VOICE } from '../../lib/piper';

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

// Barra flotante de reproducción del modo lector. Anclada abajo del área de
// contenido mientras hay una lectura activa (playing/paused).
export default function TtsPlayer() {
  const status = useTts((s) => s.status);
  const index = useTts((s) => s.index);
  const total = useTts((s) => s.total);
  const toggle = useTts((s) => s.toggle);
  const stop = useTts((s) => s.stop);
  const next = useTts((s) => s.next);
  const prev = useTts((s) => s.prev);
  const voices = useTts((s) => s.voices);
  const voiceId = useTts((s) => s.voiceId);
  const rate = useTts((s) => s.rate);
  const setVoice = useTts((s) => s.setVoice);
  const setRate = useTts((s) => s.setRate);
  const quality = useTts((s) => s.quality);
  const piperAvailable = useTts((s) => s.piperAvailable);
  const piperStatus = useTts((s) => s.piperStatus);
  const piperError = useTts((s) => s.piperError);
  const setQuality = useTts((s) => s.setQuality);

  const [rateAnchor, setRateAnchor] = useState<null | HTMLElement>(null);
  const [voiceAnchor, setVoiceAnchor] = useState<null | HTMLElement>(null);

  const active = status !== 'idle';
  const playing = status === 'playing';
  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;
  const neural = quality === 'neural';
  const loadingPiper = piperStatus === 'loading';
  const currentVoice = voices.find((v) => v.id === voiceId);
  // En modo neural la voz/velocidad del SO no aplican: Piper usa su única voz
  // bundleada y una velocidad fija (length_scale del modelo).
  const voiceTip = neural
    ? `Voz: ${PIPER_VOICE.name}`
    : currentVoice
      ? `Voz: ${currentVoice.name}`
      : 'Voz: automática';
  const qualityTip = loadingPiper
    ? 'Cargando voz neuronal…'
    : neural
      ? 'Alta calidad (Piper) — clic para volver a la voz del SO'
      : piperStatus === 'error'
        ? `No se pudo cargar Piper${piperError ? `: ${piperError}` : ''}. Usando voz del SO.`
        : 'Activar alta calidad (voz neuronal Piper, offline)';

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

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

        <Tooltip title={neural ? 'Piper usa una velocidad fija' : 'Velocidad de lectura'}>
          <span>
            <Button
              size="small"
              disabled={neural}
              onClick={(e) => setRateAnchor(e.currentTarget)}
              sx={{ minWidth: 46, color: 'text.secondary', fontSize: 12, fontWeight: 600 }}
            >
              {rate}×
            </Button>
          </span>
        </Tooltip>
        <Menu anchorEl={rateAnchor} open={!!rateAnchor} onClose={() => setRateAnchor(null)}>
          {RATES.map((r) => (
            <MenuItem
              key={r}
              selected={r === rate}
              onClick={() => {
                setRate(r);
                setRateAnchor(null);
              }}
            >
              <ListItemIcon>{r === rate ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
              <ListItemText>{r}×</ListItemText>
            </MenuItem>
          ))}
        </Menu>

        <Tooltip title={voiceTip}>
          <span>
            <IconButton
              size="small"
              disabled={neural}
              onClick={(e) => setVoiceAnchor(e.currentTarget)}
            >
              <RecordVoiceOverIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Menu
          anchorEl={voiceAnchor}
          open={!!voiceAnchor}
          onClose={() => setVoiceAnchor(null)}
          slotProps={{ paper: { sx: { maxHeight: 340 } } }}
        >
          <MenuItem
            selected={voiceId === null}
            onClick={() => {
              setVoice(null);
              setVoiceAnchor(null);
            }}
          >
            <ListItemIcon>{voiceId === null ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText primary="Automática" secondary="Según el idioma del documento" />
          </MenuItem>
          <Divider />
          {voices.map((v) => (
            <MenuItem
              key={v.id}
              selected={v.id === voiceId}
              onClick={() => {
                setVoice(v.id);
                setVoiceAnchor(null);
              }}
            >
              <ListItemIcon>{v.id === voiceId ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
              <ListItemText primary={v.name} secondary={v.lang} />
            </MenuItem>
          ))}
        </Menu>

        {piperAvailable && (
          <>
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            <Tooltip title={qualityTip}>
              <span>
                <IconButton
                  size="small"
                  disabled={loadingPiper}
                  onClick={() => setQuality(neural ? 'system' : 'neural')}
                  sx={{ color: neural ? 'primary.main' : 'text.secondary' }}
                >
                  {loadingPiper ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <AutoAwesomeIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
      </Paper>
    </Fade>
  );
}
