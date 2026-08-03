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
