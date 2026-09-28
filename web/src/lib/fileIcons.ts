import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import type { FileKind } from '../api/client';

// Ícono y color por tipo de archivo, compartidos entre el árbol y la barra de
// pestañas para que el mismo documento se vea igual en los dos lados.
export const KIND_ICON: Record<FileKind, { Icon: typeof DescriptionOutlinedIcon; color: string }> = {
  md: { Icon: DescriptionOutlinedIcon, color: '#4577c0' },
  html: { Icon: CodeOutlinedIcon, color: '#e44d26' },
  txt: { Icon: TextSnippetOutlinedIcon, color: '#6b7785' },
};
