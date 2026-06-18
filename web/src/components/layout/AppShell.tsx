import { useEffect } from 'react';
import { Box } from '@mui/material';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import Breadcrumb from '../Topbar/Breadcrumb';
import DocActions from '../Topbar/DocActions';
import ReaderContent from '../content/ReaderContent';
import { useApp } from '../../store/appStore';
import { useTree } from '../../store/treeStore';
import { useUi } from '../../store/uiStore';

// Layout principal del lector: panel lateral + barra superior + contenido.
export default function AppShell() {
  const activeApp = useApp((s) => s.activeApp);
  const currentPath = useApp((s) => s.currentPath);
  const openFile = useApp((s) => s.openFile);
  const loadTree = useTree((s) => s.loadTree);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);

  // Cargar el árbol al montar y cada vez que cambia la sub-app.
  useEffect(() => {
    loadTree(activeApp);
  }, [activeApp, loadTree]);

  // Abrir el archivo del hash de la URL una sola vez al arrancar.
  useEffect(() => {
    if (location.hash.length > 1) openFile(decodeURIComponent(location.hash.slice(1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(true)} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          sidebarCollapsed={collapsed}
          onExpandSidebar={() => setCollapsed(false)}
          center={<Breadcrumb path={currentPath} />}
          actions={<DocActions />}
        />
        <ReaderContent />
      </Box>
    </Box>
  );
}
