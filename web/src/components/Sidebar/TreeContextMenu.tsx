import { useState } from 'react';
import { ListItemIcon, ListItemText, Menu, MenuItem, Snackbar } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { TreeFile } from '../../api/client';
import { useApp } from '../../store/appStore';
import { useTree } from '../../store/treeStore';
import { alertDialog } from '../../store/dialogStore';
import { toAbsolutePath } from '../../lib/paths';

export interface CtxTarget {
  pos: { top: number; left: number };
  file: TreeFile;
}

// Menú contextual del árbol: renombrar y copiar ruta (siempre) y eliminar (solo
// Note Taker). El Snackbar vive fuera del Menu porque este se desmonta al cerrar.
export default function TreeContextMenu({ target, onClose }: { target: CtxTarget | null; onClose: () => void }) {
  const isNotes = useApp((s) => s.activeApp === 'notes');
  const renameFile = useApp((s) => s.renameFile);
  const deleteFile = useApp((s) => s.deleteFile);
  const root = useTree((s) => s.root);
  const [copied, setCopied] = useState(false);

  const path = target?.file.path ?? '';
  const fullPath = toAbsolutePath(root, path);

  const copyFullPath = async () => {
    onClose();
    try {
      await navigator.clipboard.writeText(fullPath);
      setCopied(true);
    } catch {
      // Sin acceso al portapapeles (contexto no seguro): la mostramos para copiarla a mano.
      await alertDialog({ title: 'Ruta completa', message: fullPath });
    }
  };

  return (
    <>
      {target && (
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
          <MenuItem onClick={copyFullPath} title={fullPath}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Copiar ruta completa" />
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
      )}
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Ruta copiada al portapapeles"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      />
    </>
  );
}
