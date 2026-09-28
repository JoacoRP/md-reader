import { useEffect } from 'react';
import { Box } from '@mui/material';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import TabStrip from '../Topbar/TabStrip';
import Breadcrumb from '../Topbar/Breadcrumb';
import DocActions from '../Topbar/DocActions';
import ReaderContent from '../content/ReaderContent';
import { bootstrapTabs, selectActiveTab, useApp } from '../../store/appStore';
import { useTree } from '../../store/treeStore';
import { useUi } from '../../store/uiStore';

// Layout principal del lector: panel lateral + barra superior + contenido.
export default function AppShell() {
  const activeApp = useApp((s) => s.activeApp);
  const currentPath = useApp((s) => selectActiveTab(s)?.path ?? null);
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

  // Puente para el menú "Pestañas" de Electron (Ctrl+Tab / Ctrl+W), que existe
  // porque el browser se reserva esas teclas y una página no puede interceptarlas.
  // close() avisa si había algo que cerrar: si no, el menú cierra la ventana.
  useEffect(() => {
    (window as unknown as { __mdTabs?: unknown }).__mdTabs = {
      next: () => useApp.getState().cycleTab(1),
      prev: () => useApp.getState().cycleTab(-1),
      close: () => {
        const st = useApp.getState();
        if (!st.activeTabId) return false;
        st.closeTab(st.activeTabId);
        return true;
      },
    };
  }, []);

  // Al arrancar la ventana: las pestañas de la sesión (sobreviven a un F5) más el
  // archivo que traiga el hash de la URL.
  useEffect(() => {
    bootstrapTabs();
  }, []);

  // Atajos de pestañas. Van con Ctrl+Alt y no con los Ctrl+Tab / Ctrl+W de
  // siempre porque en el browser esas dos son teclas reservadas y la página no
  // las puede interceptar; en la app de Windows el menú nativo suma esas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey || e.shiftKey) return;
      const st = useApp.getState();
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        st.cycleTab(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        st.cycleTab(-1);
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (st.activeTabId) st.closeTab(st.activeTabId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
        <TabStrip />
        <ReaderContent />
      </Box>
    </Box>
  );
}
