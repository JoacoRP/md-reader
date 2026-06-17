import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuBookIcon from '@mui/icons-material/MenuBook';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: () => void;
}

const WIDTH = 320;

// Shell del panel lateral. En la Fase 2 muestra el branding y el botón de
// colapsar; el selector de apps, raíz, búsqueda y árbol se agregan en Fase 3/4.
export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  return (
    <Box
      className="no-print"
      sx={{
        width: WIDTH,
        minWidth: WIDTH,
        ml: collapsed ? `-${WIDTH}px` : 0,
        transition: 'margin-left .2s ease',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.75,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <MenuBookIcon sx={{ color: 'primary.main' }} fontSize="small" />
        <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>Markdown Reader</Typography>
        <Tooltip title="Ocultar panel">
          <IconButton size="small" onClick={onCollapse}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
          (Árbol de archivos — Fase 3)
        </Typography>
      </Box>
    </Box>
  );
}
