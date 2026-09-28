import { useEffect, useLayoutEffect, useRef } from 'react';
import { selectActiveTab, useApp } from '../../store/appStore';

const TAB = '\t';

// Editor de texto crudo (textarea). Edición libre; el guardado es automático al
// volver a la vista formateada / cambiar de archivo / cerrar (lo maneja el store
// vía flushRawEdits). cozy = tipografía de lectura para notas (.txt o .md nuevas).
export default function RawEditor({ initial, cozy }: { initial: string; cozy: boolean }) {
  const draft = useApp((s) => selectActiveTab(s)?.draft ?? null);
  const setEditorContent = useApp((s) => s.setEditorContent);
  const flushRawEdits = useApp((s) => s.flushRawEdits);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Selección a restaurar tras un cambio programático (Tab indenta sin perder caret).
  const pendingSel = useRef<[number, number] | null>(null);

  // Sembrar el borrador con el contenido del archivo al montar/cambiar. Si la
  // pestaña ya trae borrador (p.ej. un guardado que falló y su texto es la única
  // copia), se respeta: sembrar lo pisaría. El componente se monta por pestaña
  // (key={tabId} en ReaderContent), así que esto corre una vez por documento.
  useEffect(() => {
    if (selectActiveTab(useApp.getState())?.draft == null) setEditorContent(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Reponer el caret después de que React vuelve a pintar el textarea controlado.
  useLayoutEffect(() => {
    if (pendingSel.current && ref.current) {
      const [s, e] = pendingSel.current;
      ref.current.selectionStart = s;
      ref.current.selectionEnd = e;
      pendingSel.current = null;
    }
  });

  const value = draft ?? initial;

  // Tab indenta en lugar de cambiar de foco; Shift+Tab desindenta.
  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = ref.current;
    if (!ta) return;
    e.preventDefault();
    const v = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // Caret simple (sin selección).
    if (start === end) {
      if (e.shiftKey) {
        const lineStart = v.lastIndexOf('\n', start - 1) + 1;
        const before = v.slice(lineStart, start);
        const m = before.match(/(\t| {1,2})$/);
        if (!m) return;
        const cut = m[0].length;
        setEditorContent(v.slice(0, start - cut) + v.slice(start));
        pendingSel.current = [start - cut, start - cut];
      } else {
        setEditorContent(v.slice(0, start) + TAB + v.slice(end));
        pendingSel.current = [start + 1, start + 1];
      }
      return;
    }

    // Selección de una o más líneas: indenta/desindenta el bloque completo.
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const block = v.slice(lineStart, end);
    if (e.shiftKey) {
      let removedFirst = 0;
      let removedTotal = 0;
      const dedented = block.replace(/^(\t| {1,2})/gm, (match: string, _g: string, offset: number) => {
        if (offset === 0) removedFirst = match.length;
        removedTotal += match.length;
        return '';
      });
      setEditorContent(v.slice(0, lineStart) + dedented + v.slice(end));
      pendingSel.current = [Math.max(lineStart, start - removedFirst), end - removedTotal];
    } else {
      const lineCount = (block.match(/\n/g)?.length ?? 0) + 1;
      const indented = block.replace(/^/gm, TAB);
      setEditorContent(v.slice(0, lineStart) + indented + v.slice(end));
      pendingSel.current = [start + 1, end + lineCount];
    }
  };

  return (
    <div className="markdown-body">
      <textarea
        ref={ref}
        className={`raw-editor${cozy ? ' note-editor' : ''}`}
        spellCheck={false}
        value={value}
        onChange={(e) => setEditorContent(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            flushRawEdits();
            return;
          }
          if (e.key === 'Tab') handleTab(e);
        }}
      />
    </div>
  );
}
