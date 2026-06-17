// Cliente tipado del backend Node (server.js). Las URLs y los JSON son
// idénticos a la versión vanilla; sólo cambia que ahora están tipados.

export type AppId = 'reader' | 'notes';
export type FileKind = 'md' | 'html' | 'txt';

export interface TreeFile {
  type: 'file';
  kind: FileKind;
  name: string;
  path: string;
  size: number;
  mtime: number;
}
export interface TreeDir {
  type: 'dir';
  name: string;
  path: string;
  children: TreeNode[];
}
export type TreeNode = TreeFile | TreeDir;

export interface TreeResponse {
  root: string;
  default: string;
  tree: TreeDir;
}
export interface RootResponse {
  root: string;
  notesRoot: string;
  default: string;
}
export interface FileResponse {
  path: string;
  content: string;
  mtime: number;
}
export interface TemplateInfo {
  name: string;
  file: string;
}
export interface CreatedFile {
  path: string;
  kind: FileKind;
  mtime: number;
  existed?: boolean;
}

/** Error con el mensaje que devuelve el server en `{ error }`. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || 'Error del servidor', res.status);
  }
  return data as T;
}

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const api = {
  getTree(app: AppId) {
    return fetch('/api/tree?' + qs({ app })).then(asJson<TreeResponse>);
  },
  getRoots() {
    return fetch('/api/root').then(asJson<RootResponse>);
  },
  setRoot(path: string, which?: 'notes') {
    return fetch('/api/root', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(which ? { path, which } : { path }),
    }).then(asJson<RootResponse>);
  },
  getFile(path: string, app: AppId) {
    return fetch('/api/file?' + qs({ path, app })).then(asJson<FileResponse>);
  },
  save(path: string, content: string, app: AppId) {
    return fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, app }),
    }).then(asJson<{ path: string; mtime: number }>);
  },
  create(dir: string, name: string, content: string, app: AppId) {
    return fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, name, content, app }),
    }).then(asJson<CreatedFile>);
  },
  rename(path: string, newName: string, app: AppId) {
    return fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, newName, app }),
    }).then(asJson<CreatedFile>);
  },
  remove(path: string, app: AppId) {
    return fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, app }),
    }).then(asJson<{ ok: true }>);
  },
  getTemplates(app: AppId) {
    return fetch('/api/templates?' + qs({ app })).then(asJson<{ templates: TemplateInfo[] }>);
  },
};

/** URL para servir un mock HTML bajo /mock/ preservando separadores. */
export function mockUrl(path: string): string {
  return '/mock/' + path.split('/').map(encodeURIComponent).join('/');
}

/** URL para traer un asset crudo (imágenes referenciadas en el markdown). */
export function rawUrl(path: string, app: AppId): string {
  return '/api/raw?' + qs({ path, app });
}
