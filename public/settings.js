'use strict';

/* ============================ Mock para la preview ============================ */
const MOCK_MD = `# Título de nivel 1 (h1)

Párrafo de ejemplo con **texto en negrita**, *texto en itálica*, ~~tachado~~,
\`código en línea\` y un [enlace de ejemplo](https://example.com). Este texto
sirve para evaluar el interlineado, el ancho de contenido y la legibilidad
general cuando se ajustan los parámetros del panel izquierdo.

## Título de nivel 2 (h2)

### Título de nivel 3 (h3)

#### Título de nivel 4 (h4)

##### Título de nivel 5 (h5)

###### Título de nivel 6 (h6)

> Esto es una cita (blockquote). Sirve para ver el color de acento y el
> tratamiento del texto citado.
>
> > Y una cita anidada en un segundo nivel.

---

## Listas

**Sin orden:**

- Primer ítem
- Segundo ítem
  - Sub-ítem A
  - Sub-ítem B
- Tercer ítem

**Ordenada:**

1. Paso uno
2. Paso dos
3. Paso tres

**Lista de tareas:**

- [x] Tarea completada
- [ ] Tarea pendiente
- [ ] Otra pendiente

## Tabla

| Componente | Soporta | Notas                       |
|------------|:-------:|-----------------------------|
| Encabezados| ✅      | h1 a h6                      |
| Tablas     | ✅      | con alineación de columnas  |
| Mermaid    | ✅      | flowchart, sequence, etc.   |
| Código     | ✅      | resaltado de sintaxis       |

## Bloque de código

\`\`\`javascript
// Resaltado de sintaxis con highlight.js
function saludar(nombre) {
  const mensaje = \`Hola, \${nombre}!\`;
  console.log(mensaje);
  return mensaje;
}

saludar('Markdown');
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## Diagramas Mermaid

\`\`\`mermaid
flowchart LR
    A[Inicio] --> B{¿Es .md?}
    B -- Sí --> C[Renderizar]
    B -- No --> D[Ignorar]
    C --> E[Mostrar en el lector]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant U as Usuario
    participant S as Servidor
    U->>S: GET /api/file
    S-->>U: contenido .md
    U->>U: render + estilos
\`\`\`

## Cierre

Último párrafo para verificar el espaciado entre bloques y el margen inferior
del contenido. El **fine-tuning** se refleja acá en tiempo real.
`;

/* ============================ Estado y controles ============================ */
let s = MDConfig.load();

const RANGES = [
  { id: 'fontSize', min: 12, max: 28, step: 1, suffix: 'px' },
  { id: 'lineHeight', min: 1.2, max: 2.4, step: 0.05, suffix: '' },
  { id: 'letterSpacing', min: -1, max: 3, step: 0.1, suffix: 'px' },
  { id: 'contentWidth', min: 560, max: 1500, step: 20, suffix: 'px' },
  { id: 'paragraphSpacing', min: 0.4, max: 2.2, step: 0.05, suffix: 'em' },
  { id: 'codeFontSize', min: 10, max: 20, step: 0.5, suffix: 'px' }
];
const COLORS = ['textColor', 'bgColor', 'accentColor', 'headingColor', 'linkColor'];
const SELECTS = ['fontFamily', 'linkUnderline', 'codeTheme', 'mermaidTheme', 'theme'];
const SWITCHES = ['justify'];

// Cambios que requieren re-render del markdown (no basta con cambiar variables CSS).
const RERENDER_KEYS = new Set(['theme', 'mermaidTheme', 'codeTheme']);

const el = (id) => document.getElementById(id);

function setVal(key, value) {
  const span = document.querySelector(`.val[data-val="${key}"]`);
  if (!span) return;
  const range = RANGES.find((r) => r.id === key);
  span.textContent = value + (range ? range.suffix : '');
}

// Vuelca el estado a los controles del formulario.
function syncControls() {
  RANGES.forEach((r) => {
    const input = el('set-' + r.id);
    input.min = r.min; input.max = r.max; input.step = r.step;
    input.value = s[r.id];
    setVal(r.id, s[r.id]);
  });
  COLORS.forEach((k) => { el('set-' + k).value = s[k]; });
  SELECTS.forEach((k) => { el('set-' + k).value = s[k]; });
  SWITCHES.forEach((k) => { el('set-' + k).checked = !!s[k]; });
}

/* ============================ Preview ============================ */
async function renderPreview() {
  const pv = el('preview');
  pv.innerHTML = MDCore.toSafeHtml(MOCK_MD);
  MDCore.attachCopyButtons(pv);
  await MDCore.renderMermaidIn(pv, MDConfig.resolveMermaidTheme(s));
}

// Aplica el estado: variables CSS siempre; re-render sólo si hace falta.
async function commit(changedKey) {
  MDConfig.apply(s);
  MDConfig.save(s);
  if (!changedKey || RERENDER_KEYS.has(changedKey)) await renderPreview();
}

/* ============================ Wiring ============================ */
function init() {
  MDCore.configureMarked();

  RANGES.forEach((r) => {
    el('set-' + r.id).addEventListener('input', (e) => {
      s[r.id] = Number(e.target.value);
      setVal(r.id, s[r.id]);
      commit(r.id);
    });
  });
  COLORS.forEach((k) => {
    el('set-' + k).addEventListener('input', (e) => { s[k] = e.target.value; commit(k); });
  });
  SELECTS.forEach((k) => {
    el('set-' + k).addEventListener('change', (e) => { s[k] = e.target.value; commit(k); });
  });
  SWITCHES.forEach((k) => {
    el('set-' + k).addEventListener('change', (e) => { s[k] = e.target.checked; commit(k); });
  });

  // Guardar el estado actual como tema custom
  el('preset-save').addEventListener('click', saveCurrentAsPreset);
  el('preset-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCurrentAsPreset(); });

  // Restablecer (con confirmación)
  el('reset-btn').addEventListener('click', () => {
    if (!confirm('¿Restablecer todos los valores a los predeterminados? Se perderán los ajustes actuales no guardados como tema.')) return;
    s = { ...MDConfig.DEFAULTS };
    syncControls();
    commit();
  });

  // Carpeta de notas (Note Taker): precargar valor actual y permitir cambiarlo.
  fetch('/api/root').then((r) => r.json()).then((d) => {
    if (d && d.notesRoot) el('set-notesRoot').value = d.notesRoot;
  }).catch(() => {});
  el('set-notesRoot-apply').addEventListener('click', applyNotesRoot);
  el('set-notesRoot').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyNotesRoot(); });

  renderPresetList();
  syncControls();
  MDConfig.apply(s);
  renderPreview();
}

// Cambia la carpeta de notas de Note Taker (raíz global, persistida en el server).
async function applyNotesRoot() {
  const msg = el('set-notesRoot-msg');
  const pathv = el('set-notesRoot').value.trim();
  if (!pathv) return;
  msg.textContent = 'Guardando…'; msg.className = 'form-text';
  try {
    const res = await fetch('/api/root', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathv, which: 'notes' })
    });
    const data = await res.json();
    if (!res.ok) { msg.textContent = data.error || 'No se pudo cambiar la carpeta.'; msg.className = 'form-text text-danger'; return; }
    el('set-notesRoot').value = data.notesRoot;
    msg.textContent = 'Carpeta de notas actualizada.'; msg.className = 'form-text text-success';
  } catch {
    msg.textContent = 'Error de conexión.'; msg.className = 'form-text text-danger';
  }
}

/* ============================ Temas / presets ============================ */
// Etiquetas legibles para los presets integrados.
const BUILTIN_LABELS = { default: 'Default', sepia: 'Sepia', night: 'Night', contrast: 'Alto contraste' };

function applyPreset(values) {
  Object.assign(s, values);
  syncControls();
  commit(); // re-render completo
}

function chipSwatch(values) {
  // Pequeña muestra con los colores de fondo/acento del tema.
  const bg = values.bgColor || s.bgColor;
  const accent = values.accentColor || s.accentColor;
  return `<span class="swatch" style="background:linear-gradient(135deg, ${bg} 50%, ${accent} 50%)"></span>`;
}

function renderPresetList() {
  const host = el('preset-list');
  host.innerHTML = '';

  // Integrados (esquemas de color parciales)
  for (const key of Object.keys(MDConfig.PRESETS)) {
    const values = MDConfig.PRESETS[key];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip builtin';
    chip.innerHTML = chipSwatch(values) + `<span>${BUILTIN_LABELS[key] || key}</span>`;
    chip.addEventListener('click', () => applyPreset(values));
    host.appendChild(chip);
  }

  // Custom (snapshots completos del usuario)
  const customs = MDConfig.loadPresets();
  customs.forEach((preset, idx) => {
    const chip = document.createElement('span');
    chip.className = 'preset-chip';
    chip.innerHTML = chipSwatch(preset.settings) + `<span>${escapeText(preset.name)}</span>`;
    chip.addEventListener('click', () => applyPreset(preset.settings));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.title = 'Eliminar tema';
    del.innerHTML = '<i class="bi bi-x-lg"></i>';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar el tema "${preset.name}"?`)) return;
      const list = MDConfig.loadPresets();
      list.splice(idx, 1);
      MDConfig.savePresets(list);
      renderPresetList();
    });
    chip.appendChild(del);
    host.appendChild(chip);
  });
}

function saveCurrentAsPreset() {
  const input = el('preset-name');
  const name = input.value.trim();
  const msg = el('preset-msg');
  if (!name) { msg.className = 'preset-msg err'; msg.textContent = 'Poné un nombre para el tema.'; return; }
  const list = MDConfig.loadPresets();
  const existing = list.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
  const entry = { name, settings: { ...s } };
  if (existing >= 0) {
    if (!confirm(`Ya existe un tema "${name}". ¿Sobrescribirlo?`)) return;
    list[existing] = entry;
  } else {
    list.push(entry);
  }
  MDConfig.savePresets(list);
  input.value = '';
  renderPresetList();
  msg.className = 'preset-msg ok';
  msg.textContent = `Tema "${name}" guardado.`;
}

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

init();
