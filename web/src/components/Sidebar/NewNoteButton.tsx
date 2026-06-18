import { useRef, useState } from 'react';
import { ButtonGroup, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useApp } from '../../store/appStore';

// Split-button "Nueva nota": acción principal = nota en blanco; el caret abre
// el menú de plantillas (.md en <carpeta de notas>/templates/).
export default function NewNoteButton() {
  const newBlankNote = useApp((s) => s.newBlankNote);
  const newFromTemplate = useApp((s) => s.newFromTemplate);
  const loadTemplates = useApp((s) => s.loadTemplates);
  const templates = useApp((s) => s.templates);
  const caretRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const openMenu = async () => {
    await loadTemplates();
    setOpen(true);
  };

  return (
    <>
      <ButtonGroup variant="outlined" size="small" sx={{ flexShrink: 0 }}>
        <Tooltip title="Nueva nota (.md)">
          <IconButton size="small" onClick={() => newBlankNote()} sx={{ borderRadius: 0 }}>
            <NoteAddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton ref={caretRef} size="small" onClick={openMenu} sx={{ borderRadius: 0, px: 0.25 }}>
          <ArrowDropDownIcon fontSize="small" />
        </IconButton>
      </ButtonGroup>

      <Menu anchorEl={caretRef.current} open={open} onClose={() => setOpen(false)}>
        <MenuItem
          onClick={() => {
            setOpen(false);
            newBlankNote();
          }}
        >
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Nota en blanco" />
        </MenuItem>
        {templates.map((t) => (
          <MenuItem
            key={t.file}
            onClick={() => {
              setOpen(false);
              newFromTemplate(t.file);
            }}
          >
            <ListItemIcon>
              <DescriptionOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t.name} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
