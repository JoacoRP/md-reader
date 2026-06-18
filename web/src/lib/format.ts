// Metadatos del documento: conteo de palabras, tiempo de lectura y fecha.
export function formatMeta(content: string, mtime: number): string {
  const words = (content.match(/\S+/g) || []).length;
  const mins = Math.max(1, Math.round(words / 200));
  let date = '';
  if (mtime) {
    const d = new Date(mtime);
    date = ' · ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return `${words.toLocaleString()} palabras · ${mins} min${date}`;
}
