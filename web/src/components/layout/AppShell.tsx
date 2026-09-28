import { useEffect } from 'react';
import { Box } from '@mui/material';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import Breadcrumb from '../Topbar/Breadcrumb';
import DocActions from '../Topbar/DocActions';
import ReaderContent from '../content/ReaderContent';
import { selectActiveTab, useApp } from '../../store/appStore';
import { useTree } from '../../store/treeStore';
import { useUi } from '../../store/uiStore';

// Layout principal del lector: panel lateral + barra superior + contenido.
export default function AppShell() {
  const activeApp = useApp((s) => s.activeApp);
  const currentPath = useApp((s) => selectActiveTab(s)?.path ?? null);
  const openFile = useApp((s) => s.openFile);
  const loadTree = useTree((s) => s.loadTree);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);

  const changeRoot = useTree((s) => s.changeRoot);
  const closeTabsOfApp = useApp((s) => s.closeTabsOfApp);
  const flushAllTabs = useApp((s) => s.flushAllTabs);

  // Cargar el árbol al montar y cada vez que cambia la sub-app.
  useEffect(() => {
    loadTree(activeApp);
  }, [activeApp, loadTree]);

  // Auto-refresh periódico del árbol para detectar archivos nuevos. Se pausa
  // mientras la pestaña está oculta y reconsulta al volver a foco.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) loadTree(useApp.getState().activeApp);
    };
    const id = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [loadTree]);

  // Puente para el menú nativo de Electron ("Abrir carpeta…").
  useEffect(() => {
    (window as unknown as { __mdChangeRoot?: (p: string) => void }).__mdChangeRoot = async (folder: string) => {
      const app = useApp.getState().activeApp;
      // Guardar ANTES de cambiar la raíz: después, los paths relativos de las
      // pestañas se resolverían contra la carpeta nueva.
      await flushAllTabs();
      const ok = await changeRoot(folder, app);
      if (ok) await closeTabsOfApp(app);
    };
  }, [changeRoot, closeTabsOfApp, flushAllTabs]);

  // Abrir el archivo del hash de la URL una sola vez al arrancar.
  useEffect(() => {
    if (location.hash.length > 1) openFile(decodeURIComponent(location.hash.slice(1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Red de seguridad: guardar ediciones pendientes al cerrar/recargar.
  useEffect(() => {
    const onUnload = () => {
      // Una pestaña por vez: cada una guarda contra su propia sub-app.
      for (const t of useApp.getState().tabs) {
        if (t.draft == null || t.draft === t.content) continue;
        const blob = new Blob([JSON.stringify({ path: t.path, content: t.draft, app: t.app })], {
          type: 'application/json',
        });
        navigator.sendBeacon('/api/save', blob);
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return (
    <Box className="app-shell" sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(true)} />
      <Box className="app-main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
