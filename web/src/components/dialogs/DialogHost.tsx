import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useDialog } from '../../store/dialogStore';

// Único host de diálogos: renderiza el pedido activo del dialogStore.
export default function DialogHost() {
  const current = useDialog((s) => s.current);
  const close = useDialog((s) => s.close);
  const [text, setText] = useState('');

  // Sembrar el input del prompt al abrir.
  useEffect(() => {
    if (current?.kind === 'prompt') setText(current.value);
  }, [current]);

  if (!current) return null;

  const isPrompt = current.kind === 'prompt';
  const isConfirm = current.kind === 'confirm';
  const isAlert = current.kind === 'alert';

  const confirm = () => {
    if (isPrompt) close(text.trim() || null);
    else if (isConfirm) close(true);
    else close(undefined);
  };
  const cancel = () => {
    if (isPrompt) close(null);
    else if (isConfirm) close(false);
    else close(undefined);
  };

  return (
    <Dialog open onClose={cancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>{current.title}</DialogTitle>
      <DialogContent>
        {!isPrompt && (
          <DialogContentText sx={{ whiteSpace: 'pre-line', fontSize: 14 }}>
            {'message' in current ? current.message : ''}
          </DialogContentText>
        )}
        {isPrompt && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={current.label || undefined}
            placeholder={current.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
              }
            }}
            spellCheck={false}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!isAlert && <Button onClick={cancel}>Cancelar</Button>}
        <Button
          variant="contained"
          color={current.kind === 'confirm' && current.danger ? 'error' : 'primary'}
          onClick={confirm}
        >
          {current.kind === 'alert' ? 'OK' : current.confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
