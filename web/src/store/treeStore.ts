import { create } from 'zustand';
import { api, type AppId, type TreeDir } from '../api/client';

export type SearchMode = 'files' | 'folders';

interface TreeState {
  tree: TreeDir | null;
  root: string;
  defaultRoot: string;
  searchMode: SearchMode;
  query: string;
  error: string;

  loadTree: (app: AppId) => Promise<void>;
  changeRoot: (path: string, app: AppId) => Promise<boolean>;
  resetRoot: (app: AppId) => Promise<boolean>;
  setSearchMode: (mode: SearchMode) => void;
  setQuery: (q: string) => void;
}

export const useTree = create<TreeState>((set, get) => ({
  tree: null,
  root: '',
  defaultRoot: '',
  searchMode: 'files',
  query: '',
  error: '',

  loadTree: async (app) => {
    const data = await api.getTree(app);
    set({ tree: data.tree, root: data.root, defaultRoot: data.default });
  },

  changeRoot: async (path, app) => {
    set({ error: '' });
    const target = (path || '').trim();
    if (!target) return false;
    try {
      await api.setRoot(target);
      set({ query: '' });
      await get().loadTree(app);
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo cambiar la raíz.' });
      return false;
    }
  },

  resetRoot: async (app) => {
    const def = get().defaultRoot;
    if (!def) return false;
    return get().changeRoot(def, app);
  },

  setSearchMode: (mode) => set({ searchMode: mode }),
  setQuery: (q) => set({ query: q }),
}));
