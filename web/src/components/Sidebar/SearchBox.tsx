import { Box, InputBase, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { useTree, type SearchMode } from '../../store/treeStore';

// Búsqueda en el árbol con switch entre archivos y carpetas.
export default function SearchBox() {
  const mode = useTree((s) => s.searchMode);
  const query = useTree((s) => s.query);
  const setMode = useTree((s) => s.setSearchMode);
  const setQuery = useTree((s) => s.setQuery);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={mode}
        onChange={(_e, v: SearchMode | null) => v && setMode(v)}
        sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.5 } }}
      >
        <ToggleButton value="files">
          <Tooltip title="Buscar archivos">
            <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="folders">
          <Tooltip title="Buscar carpetas">
            <FolderOutlinedIcon sx={{ fontSize: 16 }} />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      <InputBase
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={mode === 'files' ? 'Buscar archivo…' : 'Buscar carpeta…'}
        sx={{
          flex: 1,
          minWidth: 0,
          px: 1,
          py: 0.5,
          fontSize: 13,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.default',
        }}
      />
    </Box>
  );
}
