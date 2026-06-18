import { Box } from '@mui/material';
import type { Heading } from './MarkdownView';

interface TocProps {
  headings: Heading[];
  activeId: string | null;
  onJump: (id: string) => void;
}

// Tabla de contenidos lateral. Se oculta si hay menos de 2 headings.
export default function Toc({ headings, activeId, onJump }: TocProps) {
  if (headings.length < 2) return null;
  return (
    <Box
      className="toc no-print"
      sx={{
        width: 240,
        minWidth: 240,
        borderLeft: 1,
        borderColor: 'divider',
        p: 2,
        overflowY: 'auto',
        fontSize: 13,
        bgcolor: 'var(--md-bg-color)',
      }}
    >
      <div className="toc-title">Contenido</div>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className={`lvl-${h.level}${activeId === h.id ? ' active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onJump(h.id);
          }}
        >
          {h.text}
        </a>
      ))}
    </Box>
  );
}
