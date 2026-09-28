import { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import type { FileKind, TreeDir, TreeFile, TreeNode } from '../../api/client';
import { useTree } from '../../store/treeStore';
import { selectActiveTab, useApp } from '../../store/appStore';
import { ancestorDirs, computeFilter } from './treeFilter';

const KIND_ICON: Record<FileKind, { Icon: typeof DescriptionOutlinedIcon; color: string }> = {
  md: { Icon: DescriptionOutlinedIcon, color: '#4577c0' },
  html: { Icon: CodeOutlinedIcon, color: '#e44d26' },
  txt: { Icon: TextSnippetOutlinedIcon, color: '#6b7785' },
};

interface FileTreeProps {
  onContextMenu?: (e: React.MouseEvent, file: TreeFile) => void;
}

export default function FileTree({ onContextMenu }: FileTreeProps) {
  const tree = useTree((s) => s.tree);
  const searchMode = useTree((s) => s.searchMode);
  const query = useTree((s) => s.query);
  // Resaltamos la fila del documento activo sólo si su pestaña pertenece a la
  // sub-app que el árbol está mostrando (la misma ruta puede existir en las dos).
  const currentPath = useApp((s) => {
    const t = selectActiveTab(s);
    return t && t.app === s.activeApp ? t.path : null;
  });
  const openFile = useApp((s) => s.openFile);

  // Carpetas expandidas por el usuario (arrancan todas colapsadas).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Al abrir un archivo, expandimos su cadena de ancestros.
  useEffect(() => {
    if (!currentPath) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestorDirs(currentPath).forEach((d) => next.add(d));
      return next;
    });
  }, [currentPath]);

  const filter = useMemo(() => computeFilter(tree, searchMode, query), [tree, searchMode, query]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (!tree) return null;
  if (!tree.children.length) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', p: 2.5, textAlign: 'center', fontSize: 12 }}>
        Sin archivos en esta carpeta.
      </Typography>
    );
  }

  const renderNode = (node: TreeNode, depth: number) => {
    if (filter && !filter.show.has(node.path)) return null;

    if (node.type === 'file') {
      const { Icon, color } = KIND_ICON[node.kind];
      const active = currentPath === node.path;
      return (
        <Box
          key={node.path}
          onClick={() => openFile(node.path, node.kind)}
          onContextMenu={(e) => onContextMenu?.(e, node)}
          sx={rowSx(depth, active)}
        >
          <Box component="span" sx={{ width: 16, flexShrink: 0 }} />
          <Icon sx={{ fontSize: 16, color, flexShrink: 0 }} />
          <Box component="span" sx={labelSx}>
            {node.name}
          </Box>
        </Box>
      );
    }

    const isOpen = filter ? filter.expand.has(node.path) : expanded.has(node.path);
    const Folder = isOpen ? FolderOpenRoundedIcon : FolderRoundedIcon;
    return (
      <Box key={node.path}>
        <Box onClick={() => toggle(node.path)} sx={rowSx(depth, false)}>
          {isOpen ? (
            <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
          ) : (
            <KeyboardArrowRightIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
          )}
          <Folder sx={{ fontSize: 16, color: '#e0a93b', flexShrink: 0 }} />
          <Box component="span" sx={labelSx}>
            {node.name}
          </Box>
        </Box>
        {isOpen && <Box>{node.children.map((c) => renderNode(c, depth + 1))}</Box>}
      </Box>
    );
  };

  return <Box sx={{ py: 1, px: 0.5, fontSize: 13 }}>{(tree as TreeDir).children.map((c) => renderNode(c, 0))}</Box>;
}

const labelSx = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

function rowSx(depth: number, active: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 0.6,
    pl: 0.75 + depth * 1.2,
    pr: 0.75,
    py: 0.5,
    borderRadius: 1,
    cursor: 'pointer',
    userSelect: 'none',
    fontWeight: active ? 600 : 400,
    bgcolor: active ? 'var(--ui-active)' : 'transparent',
    '&:hover': { bgcolor: active ? 'var(--ui-active)' : 'var(--ui-hover)' },
  } as const;
}
