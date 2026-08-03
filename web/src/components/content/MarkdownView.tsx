import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { rawUrl } from '../../api/client';
import { useApp } from '../../store/appStore';
import { useSettings, resolveMermaidTheme } from '../../store/settingsStore';
import { useTts } from '../../store/ttsStore';
import { setTtsHighlight, scrollRangeIntoView } from '../../lib/tts';
import {
  attachCopyButtons,
  renderMermaidIn,
  resolveRelative,
  stripTags,
  toSafeHtml,
} from '../../lib/markdown';

export interface Heading {
  id: string;
  level: number;
  text: string;
}

interface MarkdownViewProps {
  content: string;
  onHeadings: (headings: Heading[]) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

// Renderiza Markdown formateado: inyecta el HTML saneado, post-procesa links e
// imágenes relativas, conecta los botones Copiar, dibuja los diagramas Mermaid
// y publica los headings para la TOC.
export default function MarkdownView({ content, onHeadings, contentRef }: MarkdownViewProps) {
  const currentPath = useApp((s) => s.currentPath);
  const activeApp = useApp((s) => s.activeApp);
  const openFile = useApp((s) => s.openFile);
  const settings = useSettings((s) => s.settings);
  const ttsStatus = useTts((s) => s.status);
  const ttsIndex = useTts((s) => s.index);
  const ttsUnits = useTts((s) => s.units);
  const ttsReadFrom = useTts((s) => s.readFrom);
  const localRef = useRef<HTMLDivElement>(null);

  // Modo lector: resalta la oración en curso y la mantiene a la vista.
  useEffect(() => {
    const range = ttsStatus !== 'idle' ? ttsUnits[ttsIndex]?.range : undefined;
    setTtsHighlight(range);
    if (range) {
      const el = contentRef.current || localRef.current;
      if (el?.parentElement) scrollRangeIntoView(range, el.parentElement);
    }
    return () => setTtsHighlight(undefined);
  }, [ttsStatus, ttsIndex, ttsUnits, contentRef]);

  useEffect(() => {
    // Re-render (cambio de archivo/tema): la lectura en curso ya no aplica.
    useTts.getState().stop();
    const el = contentRef.current || localRef.current;
    if (!el) return;
    el.innerHTML = toSafeHtml(content);
    enhance(el);
    attachCopyButtons(el);
    renderMermaidIn(
      el,
      resolveMermaidTheme(settings),
      currentPath ? { path: currentPath, app: activeApp } : undefined,
    );
    publishHeadings(el);
    if (el.parentElement) el.parentElement.scrollTop = 0;
    return () => useTts.getState().stop(); // al desmontar (cerrar/editar) también frenamos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, settings]);

  function enhance(root: HTMLElement) {
    root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        a.addEventListener('click', (e) => {
          const target = document.getElementById(decodeURIComponent(href.slice(1)));
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      } else if (/^https?:\/\//.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else if (/\.(md|markdown|mdx)$/i.test(href)) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          openFile(resolveRelative(currentPath, href));
        });
      }
    });
    root.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/^(https?:|data:|\/)/.test(src)) {
        img.src = rawUrl(resolveRelative(currentPath, src), activeApp);
      }
    });
  }

  function publishHeadings(root: HTMLElement) {
    const hs = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4'));
    onHeadings(
      hs.map((h) => ({
        id: h.id,
        level: Number(h.tagName[1]),
        text: stripTags(h.innerHTML).replace('#', ''),
      }))
    );
  }

  // "Leer desde acá": Alt+Click arranca la lectura en el párrafo clickeado; con
  // la lectura ya activa, un click simple salta a esa oración. Ignora links,
  // código, diagramas y cuando el usuario está seleccionando texto.
  function onBodyClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('a, pre, button, .mermaid-block')) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (!e.altKey && useTts.getState().status === 'idle') return;
    ttsReadFrom(e.clientX, e.clientY);
  }

  return <Box ref={contentRef ?? localRef} className="markdown-body" onClick={onBodyClick} />;
}
