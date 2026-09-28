import type { AppId } from '../api/client';

// URL de un documento dentro de la app: la misma identidad que escribe el store
// en la barra de direcciones (`?app=` + hash con la ruta). Sirve para que las
// filas del árbol y los links a .md sean links de verdad —con su destino a la
// vista y sin el autoscroll del click de rueda— y para abrir un documento en una
// ventana aparte.
export function docHref(path: string, app: AppId): string {
  return `/?app=${encodeURIComponent(app)}#${encodeURIComponent(path)}`;
}

// El árbol maneja paths relativos a la raíz y siempre con separador '/', mientras
// que la raíz que informa el server viene en el formato nativo del SO. Para copiar
// una ruta que el usuario pueda pegar en el explorador hay que unir las dos y
// normalizar el separador al del sistema.
export function toAbsolutePath(root: string, relative: string): string {
  if (!root) return relative;
  const isWindows = /^[A-Za-z]:/.test(root) || root.includes('\\');
  const sep = isWindows ? '\\' : '/';
  const base = root.replace(/[\\/]+$/, ''); // sin separador final: `C:\` -> `C:`
  const rel = isWindows ? relative.replace(/\//g, '\\') : relative;
  return base + sep + rel;
}
