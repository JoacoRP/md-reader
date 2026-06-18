import { useState } from 'react';
import { Box, Button, Chip, Divider, InputBase, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import { BUILTIN_LABELS, PRESETS, useSettings, type Settings } from '../../store/settingsStore';
import { confirmDialog } from '../../store/dialogStore';

// Muestra una franja con los colores de fondo/acento del tema.
function swatch(values: Partial<Settings>, current: Settings) {
  const bg = values.bgColor || current.bgColor;
  const accent = values.accentColor || current.accentColor;
  return (
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        border: '1px solid rgba(128,128,128,.4)',
        background: `linear-gradient(135deg, ${bg} 50%, ${accent} 50%)`,
      }}
    />
  );
}

export default function PresetList() {
  const settings = useSettings((s) => s.settings);
  const presets = useSettings((s) => s.presets);
  const patch = useSettings((s) => s.patch);
  const savePreset = useSettings((s) => s.savePreset);
  const deletePreset = useSettings((s) => s.deletePreset);

  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const save = async () => {
    const n = name.trim();
    if (!n) {
      setMsg({ text: 'Poné un nombre para el tema.', ok: false });
      return;
    }
    const exists = presets.some((p) => p.name.toLowerCase() === n.toLowerCase());
    if (exists && !(await confirmDialog({ title: 'Sobrescribir tema', message: `Ya existe un tema "${n}". ¿Sobrescribirlo?`, confirmText: 'Sobrescribir' }))) {
      return;
    }
    savePreset(n);
    setName('');
    setMsg({ text: `Tema "${n}" guardado.`, ok: true });
  };

  const remove = async (index: number, presetName: string) => {
    if (await confirmDialog({ title: 'Eliminar tema', message: `¿Eliminar el tema "${presetName}"?`, confirmText: 'Eliminar', danger: true })) {
      deletePreset(index);
    }
  };

  return (
    <>
      <Typography sx={{ fontSize: 13, mb: 0.5 }}>Elegí un tema</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {Object.keys(PRESETS).map((key) => (
          <Chip
            key={key}
            icon={<Box sx={{ ml: 1, display: 'flex' }}>{swatch(PRESETS[key], settings)}</Box>}
            label={BUILTIN_LABELS[key] || key}
            variant="outlined"
            size="small"
            onClick={() => patch(PRESETS[key])}
          />
        ))}
        {presets.map((p, i) => (
          <Chip
            key={p.name}
            icon={<Box sx={{ ml: 1, display: 'flex' }}>{swatch(p.settings, settings)}</Box>}
            label={p.name}
            variant="outlined"
            size="small"
            onClick={() => patch(p.settings)}
            onDelete={() => remove(i, p.name)}
            deleteIcon={<CloseIcon />}
          />
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography sx={{ fontSize: 13, mb: 0.5 }}>Guardar el estado actual como tema</Typography>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <InputBase
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Nombre del tema…"
          inputProps={{ maxLength: 40 }}
          sx={{ flex: 1, px: 1, py: 0.5, fontSize: 13, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}
        />
        <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={save}>
          Guardar
        </Button>
      </Box>
      {msg && (
        <Typography sx={{ fontSize: 11, mt: 0.75, color: msg.ok ? 'success.main' : 'error.main' }}>{msg.text}</Typography>
      )}
    </>
  );
}
