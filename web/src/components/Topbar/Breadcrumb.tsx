import { Box } from '@mui/material';

// Ruta del archivo abierto. El último segmento (archivo) va resaltado.
export default function Breadcrumb({ path }: { path: string | null }) {
  if (!path) return null;
  const parts = path.split('/');
  const file = parts.pop();
  return (
    <Box
      sx={{
        fontSize: 13,
        color: 'text.secondary',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {parts.map((p, i) => (
        <span key={i}>{p} / </span>
      ))}
      <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
        {file}
      </Box>
    </Box>
  );
}
