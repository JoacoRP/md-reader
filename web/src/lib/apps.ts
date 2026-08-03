import type { AppId } from '../api/client';

// Metadatos de cada sub-app (branding + versión mostrada en el selector).
export interface AppMeta {
  id: AppId;
  title: string;
  version: string;
  desc: string;
}

export const APPS: Record<AppId, AppMeta> = {
  reader: { id: 'reader', title: 'Markdown Reader', version: '2.4.0', desc: 'Leer .md y mocks HTML' },
  notes: { id: 'notes', title: 'Note Taker', version: '1.4.0', desc: 'Tomar y crear notas' },
};
