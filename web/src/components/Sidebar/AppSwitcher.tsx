import { useState } from 'react';
import { Box, Chip, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useApp } from '../../store/appStore';
import { APPS } from '../../lib/apps';
import type { AppId } from '../../api/client';

const ICON: Record<AppId, typeof MenuBookIcon> = { reader: MenuBookIcon, notes: EditNoteIcon };

// Selector de apps (el logo es un dropdown). Cambia branding y funciones.
export default function AppSwitcher() {
  const activeApp = useApp((s) => s.activeApp);
  const setApp = useApp((s) => s.setApp);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const meta = APPS[activeApp];
  const ActiveIcon = ICON[activeApp];

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 0.75,
          py: 0.5,
          borderRadius: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'var(--ui-hover)' },
        }}
      >
        <ActiveIcon sx={{ color: 'primary.main', fontSize: 18 }} />
        <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meta.title}
        </Typography>
        <Chip label={`v${meta.version}`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
        <ArrowDropDownIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
      </Box>

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {(Object.values(APPS)).map((a) => {
          const Icon = ICON[a.id];
          return (
            <MenuItem
              key={a.id}
              selected={a.id === activeApp}
              onClick={() => {
                setAnchor(null);
                setApp(a.id);
              }}
              sx={{ minWidth: 232 }}
            >
              <ListItemIcon>
                <Icon sx={{ color: 'primary.main' }} fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={a.title} secondary={a.desc} />
              <Chip label={`v${a.version}`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10, ml: 1 }} />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
