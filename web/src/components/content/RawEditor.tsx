import { useEffect, useRef } from 'react';
import { useApp } from '../../store/appStore';

// Editor de texto crudo (textarea). Edición libre; el guardado es automático al
// volver a la vista formateada / cambiar de archivo / cerrar (lo maneja el store
// vía flushRawEdits). cozy = tipografía de lectura para notas (.txt o .md nuevas).
export default function RawEditor({ initial, cozy }: { initial: string; cozy: boolean }) {
  const draft = useApp((s) => s.draft);
  const setEditorContent = useApp((s) => s.setEditorContent);
  const flushRawEdits = useApp((s) => s.flushRawEdits);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Sembrar el borrador con el contenido del archivo al montar/cambiar.
  useEffect(() => {
    setEditorContent(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const value = draft ?? initial;

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
          }
        }}
      />
    </div>
  );
}
