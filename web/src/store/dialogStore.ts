import { create } from 'zustand';

// Diálogos propios (reemplazan alert/prompt/confirm del browser) con API
// basada en promesas, igual que la versión vanilla. Un único DialogHost los
// renderiza; estas funciones devuelven una promesa con el resultado.

interface AlertReq {
  kind: 'alert';
  title: string;
  message: string;
}
interface ConfirmReq {
  kind: 'confirm';
  title: string;
  message: string;
  confirmText: string;
  danger: boolean;
}
interface PromptReq {
  kind: 'prompt';
  title: string;
  label: string;
  value: string;
  placeholder: string;
  confirmText: string;
}
type ReqInput = AlertReq | ConfirmReq | PromptReq;
type Req = ReqInput & { resolve: (r: unknown) => void };

interface DialogState {
  current: Req | null;
  close: (result: unknown) => void;
}

export const useDialog = create<DialogState>((set, get) => ({
  current: null,
  close: (result) => {
    const cur = get().current;
    set({ current: null });
    cur?.resolve(result);
  },
}));

function open<T>(req: ReqInput): Promise<T> {
  return new Promise<T>((resolve) => {
    useDialog.setState({ current: { ...req, resolve: resolve as (r: unknown) => void } as Req });
  });
}

export function alertDialog(opts: { title?: string; message?: string }): Promise<void> {
  return open<void>({ kind: 'alert', title: opts.title || 'Aviso', message: opts.message || '' });
}

export function confirmDialog(opts: {
  title?: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}): Promise<boolean> {
  return open<boolean>({
    kind: 'confirm',
    title: opts.title || 'Confirmar',
    message: opts.message || '',
    confirmText: opts.confirmText || 'Aceptar',
    danger: !!opts.danger,
  });
}

export function promptDialog(opts: {
  title?: string;
  label?: string;
  value?: string;
  placeholder?: string;
  confirmText?: string;
}): Promise<string | null> {
  return open<string | null>({
    kind: 'prompt',
    title: opts.title || '',
    label: opts.label || '',
    value: opts.value || '',
    placeholder: opts.placeholder || '',
    confirmText: opts.confirmText || 'Aceptar',
  });
}
