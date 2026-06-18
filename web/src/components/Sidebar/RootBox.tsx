import { useEffect, useState } from 'react';
import { Box, IconButton, InputBase, Tooltip, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useTree } from '../../store/treeStore';
import { useApp } from '../../store/appStore';

// Selector de raíz del lector (oculto en Note Taker: ahí la carpeta se fija en
// Settings). Input monoespaciado + botón ir + botón volver a la raíz por defecto.
export default function RootBox() {
  const root = useTree((s) => s.root);
  const error = useTree((s) => s.error);
  const changeRoot = useTree((s) => s.changeRoot);
  const activeApp = useApp((s) => s.activeApp);
  const closeFile = useApp((s) => s.closeFile);

  const [value, setValue] = useState(root);

  // Reflejar la raíz vigente salvo que el usuario esté tipeando.
  useEffect(() => {
    setValue(root);
  }, [root]);

  const apply = async (path: string) => {
    const ok = await changeRoot(path, activeApp);
    if (ok) closeFile();
  };

  if (activeApp === 'notes') return null;

  return (
    <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <InputBase
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply(value);
          }}
          placeholder="C:\ruta\a\carpeta"
          spellCheck={false}
          sx={{
            flex: 1,
            minWidth: 0,
            px: 1,
            py: 0.5,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', Consolas, monospace",
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.default',
          }}
        />
        <Tooltip title="Usar esta carpeta como raíz">
          <IconButton
            onClick={() => apply(value)}
            sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }}
          >
            <ArrowForwardIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Volver a la carpeta por defecto">
          <IconButton
            onClick={() => apply(useTree.getState().defaultRoot)}
            sx={{ width: 34, height: 34, borderRadius: 1, border: 1, borderColor: 'divider', color: 'text.secondary' }}
          >
            <RestartAltIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {error && (
        <Typography sx={{ mt: 0.75, fontSize: 11, color: 'error.main', whiteSpace: 'pre-line' }}>{error}</Typography>
      )}
    </Box>
  );
}
