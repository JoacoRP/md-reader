import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useApp } from '../../store/appStore';
import { useUi } from '../../store/uiStore';
import EmptyState from './EmptyState';
import MockFrame from './MockFrame';
import MarkdownView, { type Heading } from './MarkdownView';
import RawEditor from './RawEditor';
import Toc from './Toc';

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
    <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <Box
        ref={scrollRef}
        onScroll={onScroll}
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
    </Box>
  );
}
