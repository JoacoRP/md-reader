import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useApp } from '../../store/appStore';
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
  const currentPath = useApp((s) => s.currentPath);
  const currentKind = useApp((s) => s.currentKind);
  const currentContent = useApp((s) => s.currentContent);
  const rawMode = useApp((s) => s.rawMode);
  const forceEditOnce = useApp((s) => s.forceEditOnce);
  const ensureContent = useApp((s) => s.ensureContent);
  const tocOpen = useUi((s) => s.tocOpen);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Scrollspy: resalta el heading visible en la TOC.
  const onScroll = useCallback(() => {
    const wrap = scrollRef.current;
    const root = contentRef.current;
    if (!wrap || !root) return;
    const top = wrap.scrollTop;
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

  if (!currentPath) {
    main = <EmptyState />;
  } else if (currentKind === 'html' && !editing) {
    main = <MockFrame path={currentPath} />;
    centered = false;
  } else if (editing) {
    const cozy = (isTxt || forceEditOnce) && currentKind !== 'html';
    main = currentContent != null ? <RawEditor initial={currentContent} cozy={cozy} /> : null;
  } else {
    // Markdown formateado
    main = currentContent != null ? <MarkdownView content={currentContent} onHeadings={setHeadings} contentRef={contentRef} /> : null;
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
