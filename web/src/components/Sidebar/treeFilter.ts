import type { TreeDir, TreeNode } from '../../api/client';
import type { SearchMode } from '../../store/treeStore';

// Plan de visibilidad/expansión para el árbol según la búsqueda. Replica la
// semántica de la versión vanilla (filterFiles / filterFolders / revealDir):
//  - files: muestra archivos que matchean y expande sus carpetas ancestro.
//  - folders: revela carpetas que matchean por nombre, su contenido (subcarpetas
//    colapsadas) y la cadena de ancestros (expandida).
// Devuelve null cuando no hay query (mostrar todo, sin forzar expansión).
export interface FilterPlan {
  show: Set<string>;
  expand: Set<string>;
}

export function computeFilter(tree: TreeDir | null, mode: SearchMode, query: string): FilterPlan | null {
  const q = query.trim().toLowerCase();
  if (!tree || !q) return null;
  const show = new Set<string>();
  const expand = new Set<string>();

  const markAncestors = (ancestors: string[]) => {
    for (const a of ancestors) {
      show.add(a);
      expand.add(a);
    }
  };
  const markSubtreeVisible = (node: TreeNode) => {
    show.add(node.path);
    if (node.type === 'dir') node.children.forEach(markSubtreeVisible);
  };

  const walk = (node: TreeNode, ancestors: string[]) => {
    if (node.type === 'file') {
      if (mode === 'files' && node.name.toLowerCase().includes(q)) {
        show.add(node.path);
        markAncestors(ancestors);
      }
      return;
    }
    if (mode === 'folders' && node.name.toLowerCase().includes(q)) {
      show.add(node.path);
      expand.add(node.path);
      node.children.forEach(markSubtreeVisible); // contenido visible (subcarpetas colapsadas)
      markAncestors(ancestors);
    }
    const next = [...ancestors, node.path];
    node.children.forEach((c) => walk(c, next));
  };

  // El nodo raíz no se muestra; arrancamos por sus hijos.
  tree.children.forEach((c) => walk(c, []));
  return { show, expand };
}

/** Carpetas ancestro de un path (para auto-expandir al abrir un archivo). */
export function ancestorDirs(path: string): string[] {
  const parts = path.split('/');
  const dirs: string[] = [];
  for (let i = 1; i < parts.length; i++) dirs.push(parts.slice(0, i).join('/'));
  return dirs;
}
