import { useApp } from '../../store/appStore';

// Estado vacío acorde a la sub-app activa (sin archivo abierto).
export default function EmptyState() {
  const isNotes = useApp((s) => s.activeApp === 'notes');
  return (
    <div className="markdown-body">
      <div className="empty-state">
        {isNotes ? (
          <>
            <h1>Note Taker</h1>
            <p>
              Creá una <b>Nueva nota</b> con los botones del panel izquierdo, o abrí una nota existente.
            </p>
            <p className="hint">Las notas se editan al toque y se guardan solas. Soporta archivos .md y .txt.</p>
          </>
        ) : (
          <>
            <h1>Markdown Reader</h1>
            <p>
              Seleccioná un archivo <code>.md</code> o un mock <code>.html</code> del panel izquierdo.
            </p>
            <p className="hint">
              Soporta tablas, diagramas Mermaid, resaltado de código, tabla de contenidos, mocks HTML embebidos y
              estilos personalizables.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
