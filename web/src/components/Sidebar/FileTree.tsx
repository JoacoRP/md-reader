import { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import type { TreeDir, TreeFile, TreeNode } from '../../api/client';
import { useTree } from '../../store/treeStore';
import { selectActiveTab, useApp, type OpenOpts } from '../../store/appStore';
import { KIND_ICON } from '../../lib/fileIcons';
import { docHref } from '../../lib/paths';
import { ancestorDirs, computeFilter } from './treeFilter';

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
  const activeApp = useApp((s) => s.activeApp);

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

  // La fila de archivo es un link de verdad (ver docHref): así el click de rueda
  // no dispara el autoscroll y se ve a dónde apunta. Igual lo abrimos nosotros en
  // una pestaña interna, salvo con Shift, que se deja pasar para que el browser
  // (o Electron) abra el documento en una ventana aparte.
  const open = (e: React.MouseEvent, node: TreeFile, opts: OpenOpts) => {
    e.preventDefault();
    openFile(node.path, node.kind, opts);
  };
  const onRowClick = (e: React.MouseEvent, node: TreeFile) => {
    if (e.shiftKey) return;
    open(e, node, e.ctrlKey || e.metaKey ? { newTab: true, background: true } : {});
  };
  const onRowAux = (e: React.MouseEvent, node: TreeFile) => {
    if (e.button !== 1) return; // rueda
    open(e, node, { newTab: true, background: true });
  };

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
          component="a"
          href={docHref(node.path, activeApp)}
          onClick={(e: React.MouseEvent) => onRowClick(e, node)}
          onAuxClick={(e: React.MouseEvent) => onRowAux(e, node)}
          onContextMenu={(e: React.MouseEvent) => onContextMenu?.(e, node)}
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
    color: 'inherit', // las filas de archivo son <a>: sin color ni subrayado de link
    textDecoration: 'none',
    fontWeight: active ? 600 : 400,
    bgcolor: active ? 'var(--ui-active)' : 'transparent',
    '&:hover': { bgcolor: active ? 'var(--ui-active)' : 'var(--ui-hover)' },
  } as const;
}
