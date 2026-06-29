import { create } from 'zustand';

const WIDTH_KEY = 'md-reader-sidebar-width';
export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 320;

export function clampSidebarWidth(n: number): number {
  if (!Number.isFinite(n)) return SIDEBAR_DEFAULT;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(n)));
}

function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    return raw ? clampSidebarWidth(parseInt(raw, 10)) : SIDEBAR_DEFAULT;
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

interface UiState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  tocOpen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarWidth: (v: number) => void;
  toggleToc: () => void;
}

export const useUi = create<UiState>((set) => ({
  sidebarCollapsed: false,
  sidebarWidth: loadSidebarWidth(),
  tocOpen: true,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarWidth: (v) => {
    const w = clampSidebarWidth(v);
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch {
      /* best-effort */
    }
    set({ sidebarWidth: w });
  },
  toggleToc: () => set((s) => ({ tocOpen: !s.tocOpen })),
}));
