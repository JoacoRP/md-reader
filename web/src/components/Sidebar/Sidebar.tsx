import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import type { TreeFile } from '../../api/client';
import { useTree } from '../../store/treeStore';
import { useApp } from '../../store/appStore';
import { useUi, SIDEBAR_MIN, SIDEBAR_MAX } from '../../store/uiStore';
import AppSwitcher from './AppSwitcher';
import NewNoteButton from './NewNoteButton';
import SearchBox from './SearchBox';
import FileTree from './FileTree';
import TreeContextMenu, { type CtxTarget } from './TreeContextMenu';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: () => void;
}

// Panel lateral: selector de apps, "Nueva nota" (Note Taker), raíz, búsqueda,
// árbol y menú contextual. Ancho redimensionable con el handle del borde derecho.
export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const root = useTree((s) => s.root);
  const isNotes = useApp((s) => s.activeApp === 'notes');
  const width = useUi((s) => s.sidebarWidth);
  const setWidth = useUi((s) => s.setSidebarWidth);
  const [ctx, setCtx] = useState<CtxTarget | null>(null);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const onContextMenu = (e: React.MouseEvent, file: TreeFile) => {
    e.preventDefault();
    setCtx({ pos: { top: e.clientY, left: e.clientX }, file });
  };

  // Arrastre del handle: el ancho es clientX relativo al borde izquierdo del panel.
  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;
    const left = ref.current?.getBoundingClientRect().left ?? 0;
    const onMove = (e: MouseEvent) => setWidth(e.clientX - left);
    const onUp = () => setDragging(false);
    // Evita selección de texto y fija el cursor durante el arrastre.
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragging, setWidth]);

  return (
    <Box
      ref={ref}
      className="no-print"
      sx={{
        position: 'relative',
        width,
        minWidth: width,
        ml: collapsed ? `-${width}px` : 0,
        transition: dragging ? 'none' : 'margin-left .2s ease',
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

      <SearchBox />

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <FileTree onContextMenu={onContextMenu} />
      </Box>

      <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider', fontSize: 11, color: 'text.secondary', wordBreak: 'break-all' }}>
        <Box sx={{ color: 'text.secondary', mb: 0.25 }}>Raíz actual:</Box>
        <Box title={root}>{root}</Box>
      </Box>

      {/* Handle de redimensionado (borde derecho). */}
      {!collapsed && (
        <Box
          onMouseDown={startDrag}
          onDoubleClick={() => setWidth(320)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar panel"
          title={`Arrastrar para redimensionar (${SIDEBAR_MIN}–${SIDEBAR_MAX}px) · doble clic para restablecer`}
          sx={{
            position: 'absolute',
            top: 0,
            right: -3,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 2,
            '&:hover::after, &:active::after': { opacity: 1 },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 2,
              width: 2,
              height: '100%',
              bgcolor: 'primary.main',
              opacity: dragging ? 1 : 0,
              transition: 'opacity .15s',
            },
          }}
        />
      )}

      <TreeContextMenu target={ctx} onClose={() => setCtx(null)} />
    </Box>
  );
}
