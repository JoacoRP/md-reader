import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import type { TreeFile } from '../../api/client';
import { useApp } from '../../store/appStore';

export interface CtxTarget {
  pos: { top: number; left: number };
  file: TreeFile;
}

// Menú contextual del árbol: renombrar (siempre) y eliminar (solo Note Taker).
export default function TreeContextMenu({ target, onClose }: { target: CtxTarget | null; onClose: () => void }) {
  const isNotes = useApp((s) => s.activeApp === 'notes');
  const renameFile = useApp((s) => s.renameFile);
  const deleteFile = useApp((s) => s.deleteFile);

  if (!target) return null;
  const path = target.file.path;

  return (
    <Menu
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={target.pos}
    >
      <MenuItem
        onClick={() => {
          onClose();
          renameFile(path);
        }}
      >
        <ListItemIcon>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Renombrar" />
      </MenuItem>
      {isNotes && (
        <MenuItem
          onClick={() => {
            onClose();
            deleteFile(path);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText primary="Eliminar" />
        </MenuItem>
      )}
    </Menu>
  );
}
