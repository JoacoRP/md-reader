import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useTree } from '../../store/treeStore';
import RootBox from './RootBox';
import SearchBox from './SearchBox';
import FileTree from './FileTree';

const WIDTH = 320;

interface SidebarProps {
  collapsed: boolean;
  onCollapse: () => void;
}

// Panel lateral del lector: branding, selector de raíz, búsqueda y árbol.
// (El selector de apps y "Nueva nota" se agregan en la Fase 4.)
export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const root = useTree((s) => s.root);

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <MenuBookIcon sx={{ color: 'primary.main' }} fontSize="small" />
        <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>Markdown Reader</Typography>
        <Tooltip title="Ocultar panel">
          <IconButton size="small" onClick={onCollapse}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <RootBox />
      <SearchBox />

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <FileTree />
      </Box>

      <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider', fontSize: 11, color: 'text.secondary', wordBreak: 'break-all' }}>
        <Box sx={{ color: 'text.secondary', mb: 0.25 }}>Raíz actual:</Box>
        <Box title={root}>{root}</Box>
      </Box>
    </Box>
  );
}
