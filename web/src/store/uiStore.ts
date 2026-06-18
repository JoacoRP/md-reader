import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  tocOpen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleToc: () => void;
}

export const useUi = create<UiState>((set) => ({
  sidebarCollapsed: false,
  tocOpen: true,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleToc: () => set((s) => ({ tocOpen: !s.tocOpen })),
}));
