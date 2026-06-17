import { useState } from 'react';
import { Box } from '@mui/material';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';

// Layout principal del lector: panel lateral colapsable + barra superior +
// área de contenido. El contenido real (markdown/editor/mock) llega en Fase 3.
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(true)} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar sidebarCollapsed={collapsed} onExpandSidebar={() => setCollapsed(false)} />

        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            bgcolor: 'var(--md-bg-color)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box className="markdown-body">
            <div className="empty-state">
              <h1>Markdown Reader</h1>
              <p>Shell migrado a React + MUI.</p>
              <p className="hint">El árbol, el render de Markdown y el editor llegan en las próximas fases.</p>
            </div>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
