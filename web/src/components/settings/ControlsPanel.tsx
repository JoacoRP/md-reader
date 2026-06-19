import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  Typography,
} from '@mui/material';
import { useSettings, type Settings } from '../../store/settingsStore';
import PresetList from './PresetList';
import RootCard from './RootCard';

interface RangeDef {
  id: keyof Settings;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
}
const RANGES: RangeDef[] = [
  { id: 'fontSize', label: 'Tamaño de fuente', min: 8, max: 28, step: 1, suffix: 'px' },
  { id: 'lineHeight', label: 'Interlineado', min: 1.2, max: 2.4, step: 0.05, suffix: '' },
  { id: 'letterSpacing', label: 'Espaciado de letras', min: -1, max: 3, step: 0.1, suffix: 'px' },
  { id: 'contentWidth', label: 'Ancho de contenido', min: 560, max: 1500, step: 20, suffix: 'px' },
  { id: 'paragraphSpacing', label: 'Separación de párrafos', min: 0.4, max: 2.2, step: 0.05, suffix: 'em' },
];
const CODE_RANGE: RangeDef = { id: 'codeFontSize', label: 'Tamaño de código', min: 10, max: 20, step: 0.5, suffix: 'px' };

const COLORS: { id: keyof Settings; label: string }[] = [
  { id: 'textColor', label: 'Texto' },
  { id: 'bgColor', label: 'Fondo' },
  { id: 'accentColor', label: 'Acento' },
  { id: 'headingColor', label: 'Títulos' },
  { id: 'linkColor', label: 'Enlaces' },
];

const FONT_OPTS = [
  { v: 'system', l: 'Sistema (sans-serif)' },
  { v: 'serif', l: 'Serif (lectura)' },
  { v: 'inter', l: 'Inter' },
  { v: 'georgia', l: 'Georgia' },
  { v: 'mono', l: 'Monospace' },
];
const UNDERLINE_OPTS = [
  { v: 'none', l: 'Nunca' },
  { v: 'hover', l: 'Al pasar el mouse' },
  { v: 'always', l: 'Siempre' },
];
const CODE_THEME_OPTS = [
  { v: 'auto', l: 'Automático (según tema)' },
  { v: 'light', l: 'Claro' },
  { v: 'dark', l: 'Oscuro' },
];
const MERMAID_OPTS = [
  { v: 'auto', l: 'Automático (según tema)' },
  { v: 'default', l: 'Default' },
  { v: 'neutral', l: 'Neutral' },
  { v: 'forest', l: 'Forest' },
  { v: 'dark', l: 'Dark' },
];
const UI_THEME_OPTS = [
  { v: 'light', l: 'Claro' },
  { v: 'dark', l: 'Oscuro' },
];

export default function ControlsPanel() {
  const settings = useSettings((s) => s.settings);
  const patch = useSettings((s) => s.patch);

  const rangeControl = (r: RangeDef) => {
    const value = settings[r.id] as number;
    return (
      <Box key={r.id} sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 13 }}>{r.label}</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {value}
            {r.suffix}
          </Typography>
        </Box>
        <Slider
          size="small"
          min={r.min}
          max={r.max}
          step={r.step}
          value={value}
          onChange={(_e, v) => patch({ [r.id]: v as number } as Partial<Settings>)}
        />
      </Box>
    );
  };

  const selectControl = (id: keyof Settings, label: string, opts: { v: string; l: string }[]) => (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 13, mb: 0.25 }}>{label}</Typography>
      <Select
        fullWidth
        size="small"
        value={settings[id] as string}
        onChange={(e) => patch({ [id]: e.target.value } as Partial<Settings>)}
        sx={{ fontSize: 13 }}
      >
        {opts.map((o) => (
          <MenuItem key={o.v} value={o.v} sx={{ fontSize: 13 }}>
            {o.l}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );

  return (
    <Box
      sx={{
        width: 380,
        minWidth: 380,
        overflowY: 'auto',
        p: 2,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardHeader title="Temas" titleTypographyProps={{ fontSize: 13, fontWeight: 600 }} sx={{ pb: 0 }} />
        <CardContent>
          <PresetList />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardHeader title="Tipografía" titleTypographyProps={{ fontSize: 13, fontWeight: 600 }} sx={{ pb: 0 }} />
        <CardContent>
          {selectControl('fontFamily', 'Familia tipográfica', FONT_OPTS)}
          {RANGES.map(rangeControl)}
          <FormControlLabel
            control={<Switch size="small" checked={settings.justify} onChange={(e) => patch({ justify: e.target.checked })} />}
            label={<Typography sx={{ fontSize: 13 }}>Justificar texto</Typography>}
          />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardHeader title="Colores" titleTypographyProps={{ fontSize: 13, fontWeight: 600 }} sx={{ pb: 0 }} />
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
            {COLORS.map((c) => (
              <Box key={c.id}>
                <Typography sx={{ fontSize: 13, mb: 0.25 }}>{c.label}</Typography>
                <input
                  type="color"
                  value={settings[c.id] as string}
                  onChange={(e) => patch({ [c.id]: e.target.value } as Partial<Settings>)}
                  style={{ width: '100%', height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </Box>
            ))}
          </Box>
          {selectControl('linkUnderline', 'Subrayado de enlaces', UNDERLINE_OPTS)}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardHeader title="Código y diagramas" titleTypographyProps={{ fontSize: 13, fontWeight: 600 }} sx={{ pb: 0 }} />
        <CardContent>
          {rangeControl(CODE_RANGE)}
          {selectControl('codeTheme', 'Tema de código', CODE_THEME_OPTS)}
          {selectControl('mermaidTheme', 'Tema de Mermaid', MERMAID_OPTS)}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardHeader title="General" titleTypographyProps={{ fontSize: 13, fontWeight: 600 }} sx={{ pb: 0 }} />
        <CardContent>{selectControl('theme', 'Tema de la interfaz', UI_THEME_OPTS)}</CardContent>
      </Card>

      <RootCard which="reader" title="Carpeta del lector (Markdown Reader)" />
      <RootCard which="notes" title="Carpeta de notas (Note Taker)" />
    </Box>
  );
}
