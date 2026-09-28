import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { selectActiveTab, useApp } from '../../store/appStore';
import { useUi } from '../../store/uiStore';
import { useTts } from '../../store/ttsStore';
import EmptyState from './EmptyState';
import MockFrame from './MockFrame';
import MarkdownView, { type Heading } from './MarkdownView';
import RawEditor from './RawEditor';
import Toc from './Toc';
import TtsPlayer from './TtsPlayer';

// Área de contenido del lector: elige entre mock HTML (iframe), Markdown
// formateado o editor de texto crudo, y maneja la TOC + scrollspy.
export default function ReaderContent() {
  // Selectores de campos sueltos (no de la pestaña entera) para no re-renderizar
  // el área de contenido con cada tecla del editor, que sólo toca el borrador.
  const tabId = useApp((s) => selectActiveTab(s)?.id ?? null);
  const currentPath = useApp((s) => selectActiveTab(s)?.path ?? null);
  const currentKind = useApp((s) => selectActiveTab(s)?.kind ?? 'md');
  const currentContent = useApp((s) => selectActiveTab(s)?.content ?? null);
  const currentError = useApp((s) => selectActiveTab(s)?.error ?? null);
  const forceEditOnce = useApp((s) => selectActiveTab(s)?.forceEditOnce ?? false);
  const rawMode = useApp((s) => s.rawMode);
  const ensureContent = useApp((s) => s.ensureContent);
  const tocOpen = useUi((s) => s.tocOpen);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Posición de lectura en vivo. Va en un ref y no en el store para no escribir
  // a cada píxel, y se toma del evento de scroll y no del DOM al salir: cuando
  // React desmonta el documento de la pestaña que dejamos, el contenedor se
  // queda sin altura y el navegador ya clampeó scrollTop a 0.
  const scrollTopRef = useRef(0);
  const restoredFor = useRef<string | null>(null);

  const isTxt = currentKind === 'txt';
  const editing = rawMode || isTxt || forceEditOnce;

  // HTML en edición necesita traer el contenido (los demás ya lo cargó openFile).
  useEffect(() => {
    if (editing && currentKind === 'html' && currentContent == null) ensureContent();
  }, [editing, currentKind, currentContent, ensureContent]);

  // Atajos del modo lector: espacio = play/pausa, Escape = detener. Sólo actúan
  // con lectura activa y fuera de campos editables/botones (para no pisar el
  // scroll con la barra, ni la escritura ni el foco de los controles).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
      const tts = useTts.getState();
      if (tts.status === 'idle') return;
      if (e.code === 'Space') {
        e.preventDefault();
        tts.toggle();
      } else if (e.code === 'Escape') {
        tts.stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Al salir de una pestaña le dejamos anotada su posición de lectura, y al
  // volver la reponemos una sola vez (MarkdownView arranca el documento en 0 al
  // montar; este efecto es del padre, así que corre después y gana).
  useEffect(() => {
    const id = tabId;
    if (!id) return;
    return () => useApp.getState().setTabScroll(id, scrollTopRef.current);
  }, [tabId]);

  useEffect(() => {
    if (!tabId || currentContent == null || restoredFor.current === tabId) return;
    restoredFor.current = tabId;
    const top = useApp.getState().tabs.find((t) => t.id === tabId)?.scrollTop ?? 0;
    if (top && scrollRef.current) scrollRef.current.scrollTop = top;
  }, [tabId, currentContent]);

  // Scrollspy: resalta el heading visible en la TOC.
  const onScroll = useCallback(() => {
    const wrap = scrollRef.current;
    if (!wrap) return;
    // La posición se anota siempre, aunque no haya TOC que resaltar (editor, mock).
    const top = wrap.scrollTop;
    scrollTopRef.current = top;
    const root = contentRef.current;
    if (!root) return;
    let active: string | null = null;
    root.querySelectorAll<HTMLElement>('h1, h2, h3, h4').forEach((h) => {
      if (h.offsetTop - 90 <= top) active = h.id;
    });
    setActiveId(active);
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- Decidir qué renderizar ---
  let main: React.ReactNode;
  let centered = true;
  let showToc = false;

  // Todo lo que renderiza el documento va con key={tabId}: al cambiar de pestaña
  // queremos un montaje nuevo, no el mismo componente con otras props. Sin eso el
  // editor sembraría el archivo encima del borrador sin guardar de la pestaña que
  // entra, y dos pestañas con contenido idéntico dejarían la TOC vieja.
  if (!currentPath) {
    main = <EmptyState />;
  } else if (currentError && currentContent == null) {
    // Suele ser un archivo movido o borrado por fuera (o una pestaña que la
    // sesión restauró y ya no existe): mejor decirlo que quedar en blanco.
    main = (
      <Box sx={{ p: 4, color: 'error.main', fontSize: 14 }}>
        No se pudo abrir <strong>{currentPath}</strong>: {currentError}
      </Box>
    );
  } else if (currentKind === 'html' && !editing) {
    main = <MockFrame key={tabId} path={currentPath} />;
    centered = false;
  } else if (editing) {
    const cozy = (isTxt || forceEditOnce) && currentKind !== 'html';
    main = currentContent != null ? <RawEditor key={tabId} initial={currentContent} cozy={cozy} /> : null;
  } else {
    // Markdown formateado
    main =
      currentContent != null ? (
        <MarkdownView key={tabId} content={currentContent} onHeadings={setHeadings} contentRef={contentRef} />
      ) : null;
    showToc = tocOpen && headings.length >= 2;
  }

  return (
    <Box className="content-area" sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      <Box
        ref={scrollRef}
        onScroll={onScroll}
        className="content-scroll"
        sx={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: centered ? 'center' : 'stretch',
          bgcolor: 'var(--md-bg-color)',
        }}
      >
        {main}
      </Box>
      {showToc && <Toc headings={headings} activeId={activeId} onJump={jump} />}
      <TtsPlayer />
    </Box>
  );
}
