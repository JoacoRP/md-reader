import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, CardHeader, TextField, Typography } from '@mui/material';
import { api } from '../../api/client';
import { useApp } from '../../store/appStore';
import { useTree } from '../../store/treeStore';

// Card para configurar la raíz de una sub-app (lector o notas). Es el ÚNICO
// punto para cambiar las carpetas: persiste en config.json (server) y queda
// cacheado, así el .env sólo siembra la primera vez.
export default function RootCard({ which, title }: { which: 'reader' | 'notes'; title: string }) {
  const [path, setPath] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    api
      .getRoots()
      .then((d) => setPath(which === 'notes' ? d.notesRoot : d.root))
      .catch(() => {});
  }, [which]);

  const apply = async () => {
    const p = path.trim();
    if (!p) return;
    setMsg({ text: 'Guardando…', ok: true });
    try {
      const d = await api.setRoot(p, which === 'notes' ? 'notes' : undefined);
      setPath(which === 'notes' ? d.notesRoot : d.root);
      // Si es la sub-app activa, refrescamos el árbol y cerramos el documento
      // abierto (puede pertenecer a la raíz anterior).
      if (useApp.getState().activeApp === which) {
        useApp.getState().closeFile();
        useTree.getState().loadTree(which);
      }
      setMsg({ text: 'Carpeta actualizada.', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'No se pudo cambiar la carpeta.', ok: false });
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardHeader title={title} titleTypographyProps={{ fontSize: 13, fontWeight: 600 }} sx={{ pb: 0 }} />
      <CardContent>
        <Typography sx={{ fontSize: 13, mb: 0.5 }}>Ruta de la carpeta</Typography>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <TextField
            fullWidth
            size="small"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            placeholder={which === 'notes' ? 'C:\\Users\\...\\Notas' : 'C:\\ruta\\a\\carpeta'}
            spellCheck={false}
            InputProps={{ sx: { fontSize: 13, fontFamily: "'JetBrains Mono', Consolas, monospace" } }}
          />
          <Button variant="contained" size="small" onClick={apply}>
            Aplicar
          </Button>
        </Box>
        {msg && <Typography sx={{ fontSize: 11, mt: 0.75, color: msg.ok ? 'success.main' : 'error.main' }}>{msg.text}</Typography>}
      </CardContent>
    </Card>
  );
}
