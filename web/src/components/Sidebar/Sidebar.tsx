import { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import type { TreeFile } from '../../api/client';
import { useTree } from '../../store/treeStore';
import { useApp } from '../../store/appStore';
import AppSwitcher from './AppSwitcher';
import NewNoteButton from './NewNoteButton';
import RootBox from './RootBox';
import SearchBox from './SearchBox';
import FileTree from './FileTree';
import TreeContextMenu, { type CtxTarget } from './TreeContextMenu';

const WIDTH = 320;

interface SidebarProps {
  collapsed: boolean;
  onCollapse: () => void;
}

// Panel lateral: selector de apps, "Nueva nota" (Note Taker), raíz, búsqueda,
// árbol y menú contextual.
export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const root = useTree((s) => s.root);
  const isNotes = useApp((s) => s.activeApp === 'notes');
  const [ctx, setCtx] = useState<CtxTarget | null>(null);

  const onContextMenu = (e: React.MouseEvent, file: TreeFile) => {
    e.preventDefault();
    setCtx({ pos: { top: e.clientY, left: e.clientX }, file });
  };

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <AppSwitcher />
        {isNotes && <NewNoteButton />}
        <Tooltip title="Ocultar panel">
          <IconButton size="small" onClick={onCollapse}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <RootBox />
      <SearchBox />

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <FileTree onContextMenu={onContextMenu} />
      </Box>

      <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider', fontSize: 11, color: 'text.secondary', wordBreak: 'break-all' }}>
        <Box sx={{ color: 'text.secondary', mb: 0.25 }}>Raíz actual:</Box>
        <Box title={root}>{root}</Box>
      </Box>

      <TreeContextMenu target={ctx} onClose={() => setCtx(null)} />
    </Box>
  );
}
