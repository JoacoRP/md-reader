import { Box, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

// Placeholder de la Fase 2. La página completa (controles + preview + presets)
// se implementa en la Fase 5.
export default function SettingsPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Volver
      </Button>
      <Typography variant="h5">Configuración</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
        (Controles de estilo, preview en vivo y presets — Fase 5)
      </Typography>
    </Box>
  );
}
