import { Box, IconButton, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../store/settingsStore';

interface TopbarProps {
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  /** Slot central: breadcrumb (lo llena la Fase 3). */
  center?: React.ReactNode;
  /** Acciones específicas del documento (raw, toc, abrir mock): Fase 3/4. */
  actions?: React.ReactNode;
}

// Barra superior. En la Fase 2 trae el toggle de tema, ir a Settings e imprimir;
// el breadcrumb y las acciones de documento se inyectan vía props más adelante.
export default function Topbar({ sidebarCollapsed, onExpandSidebar, center, actions }: TopbarProps) {
  const navigate = useNavigate();
  const mode = useSettings((s) => s.settings.theme);
  const toggleTheme = useSettings((s) => s.toggleTheme);

  return (
    <Box
      className="no-print"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      {sidebarCollapsed && (
        <Tooltip title="Mostrar panel">
          <IconButton size="small" onClick={onExpandSidebar}>
            <MenuIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>{center}</Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {actions}
        <Tooltip title={mode === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
          <IconButton size="small" onClick={toggleTheme}>
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Configuración de estilos">
          <IconButton size="small" onClick={() => navigate('/settings')}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Imprimir / PDF">
          <IconButton size="small" onClick={() => window.print()}>
            <PrintIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
