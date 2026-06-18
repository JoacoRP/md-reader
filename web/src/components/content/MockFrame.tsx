import { Box } from '@mui/material';
import { mockUrl } from '../../api/client';

// Mock HTML "con esteroides" embebido en un iframe (assets/links relativos
// resuelven contra /mock/).
export default function MockFrame({ path }: { path: string }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', bgcolor: '#fff' }}>
      <iframe className="mock-frame" src={mockUrl(path)} title={path} />
    </Box>
  );
}
