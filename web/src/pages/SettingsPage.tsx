import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/settingsStore';
import { confirmDialog } from '../store/dialogStore';
import ControlsPanel from '../components/settings/ControlsPanel';
import PreviewPanel from '../components/settings/PreviewPanel';

// Página de configuración: panel izquierdo de controles + preview en vivo.
export default function SettingsPage() {
  const navigate = useNavigate();
  const reset = useSettings((s) => s.reset);

  const onReset = async () => {
    const ok = await confirmDialog({
      title: 'Restablecer',
      message: '¿Restablecer todos los valores a los predeterminados? Se perderán los ajustes actuales no guardados como tema.',
      confirmText: 'Restablecer',
      danger: true,
    });
    if (ok) reset();
  };

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
        <Tooltip title="Volver al lector">
          <IconButton size="small" onClick={() => navigate('/')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <SettingsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Configuración de estilos</Typography>
        <Button size="small" color="error" variant="outlined" startIcon={<RestartAltIcon />} onClick={onReset}>
          Restablecer
        </Button>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <ControlsPanel />
        <PreviewPanel />
      </Box>
    </Box>
  );
}
