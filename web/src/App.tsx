import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { api, type TreeResponse } from './api/client';

// Fase 1: smoke test del andamiaje. Verifica que React levanta y que el
// proxy/cliente llega al backend Node. Se reemplaza por el layout real en Fase 2+.
export default function App() {
  const [data, setData] = useState<TreeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTree('reader').then(setData).catch((e) => setError(String(e)));
  }, []);

  return (
    <Box sx={{ p: 4, fontFamily: 'system-ui' }}>
      <Typography variant="h4" gutterBottom>
        Markdown Reader — React
      </Typography>
      {!data && !error && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            Backend conectado. Raíz: <code>{data.root}</code>
          </Alert>
          <Typography variant="body2">
            {data.tree.children.length} entradas de primer nivel.
          </Typography>
        </>
      )}
    </Box>
  );
}
