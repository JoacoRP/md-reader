import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useApp } from '../../store/appStore';
import { APPS } from '../../lib/apps';
import { KIND_ICON } from '../../lib/fileIcons';

// Barra de documentos abiertos. Click activa, click de rueda cierra (como en el
// browser) y la × aparece al pasar por encima. Se esconde cuando no hay nada
// abierto: ahí manda el EmptyState.
export default function TabStrip() {
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const activateTab = useApp((s) => s.activateTab);
  const closeTab = useApp((s) => s.closeTab);
  const ref = useRef<HTMLDivElement>(null);

  // La pestaña activa siempre a la vista: se puede activar con el teclado o al
  // cerrar la de al lado, sin que el mouse haya pasado por la barra.
  useEffect(() => {
    ref.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

  if (!tabs.length) return null;

  return (
    <Box
      ref={ref}
      className="no-print"
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        flexShrink: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        '&::-webkit-scrollbar': { height: 5 },
      }}
    >
      {tabs.map((tab) => {
        const { Icon, color } = KIND_ICON[tab.kind];
        const active = tab.id === activeTabId;
        const dirty = tab.saveStatus === 'dirty' || tab.saveStatus === 'saving';
        return (
          <Box
            key={tab.id}
            data-active={active}
            onClick={() => activateTab(tab.id)}
            onAuxClick={(e: React.MouseEvent) => {
              if (e.button !== 1) return;
              e.preventDefault();
              closeTab(tab.id);
            }}
            title={`${tab.path} · ${APPS[tab.app].title}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.6,
              flexShrink: 0,
              maxWidth: 220,
              px: 1.25,
              py: 0.9,
              fontSize: 12.5,
              cursor: 'pointer',
              userSelect: 'none',
              borderRight: 1,
              borderColor: 'divider',
              color: active ? 'text.primary' : 'text.secondary',
              fontWeight: active ? 600 : 400,
              bgcolor: active ? 'var(--ui-active)' : 'transparent',
              boxShadow: active ? (t) => `inset 0 -2px 0 ${t.palette.primary.main}` : 'none',
              '&:hover': { bgcolor: active ? 'var(--ui-active)' : 'var(--ui-hover)' },
              '&:hover .tab-close': { opacity: 1 },
            }}
          >
            <Icon sx={{ fontSize: 15, color, flexShrink: 0 }} />
            <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab.path.split('/').pop()}
            </Box>
            {dirty && (
              <Box
                component="span"
                title="Sin guardar"
                sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.secondary', flexShrink: 0 }}
              />
            )}
            <Box
              className="tab-close"
              component="span"
              role="button"
              aria-label={`Cerrar ${tab.path.split('/').pop()}`}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation(); // cerrar, no activar
                closeTab(tab.id);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 0.75,
                flexShrink: 0,
                opacity: active ? 0.7 : 0,
                transition: 'opacity .12s',
                '&:hover': { bgcolor: 'var(--ui-hover)', opacity: 1 },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
