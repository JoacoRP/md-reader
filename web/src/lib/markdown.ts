// Núcleo de renderizado Markdown (port de public/md-core.js): parseo +
// sanitización, resaltado de código, captura de diagramas Mermaid y utilidades.
// Antes dependía de globals (marked, DOMPurify, hljs, mermaid); ahora son imports
// que Vite bundlea. highlight.js/lib/common = build con los lenguajes habituales
// (equivalente al highlight.min.js vendoreado).
import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import mermaid from 'mermaid';
import { attachPanZoom, unlockSvgSize } from './panzoom';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}
export function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

// Resuelve una ruta relativa `rel` respecto del archivo `fromFile` (paths POSIX).
export function resolveRelative(fromFile: string | null, rel: string): string {
  const base = (fromFile || '').split('/').slice(0, -1);
  for (const part of rel.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return base.join('/');
}

// Slugs únicos por documento para los anchors de los headings.
let slugCounts: Record<string, number> = {};
function resetSlugs() {
  slugCounts = {};
}
export function slugify(text: string): string {
  let base = text
    .toLowerCase()
    .trim()
    .replace(/[^\wÀ-ɏ\s-]/g, '')
    .replace(/\s+/g, '-');
  if (!base) base = 'section';
  if (slugCounts[base] != null) {
    slugCounts[base]++;
    base = base + '-' + slugCounts[base];
  } else {
    slugCounts[base] = 0;
  }
  return base;
}

let mermaidCounter = 0;
let mermaidRenderSeq = 0;
let configured = false;

export function configureMarked(): void {
  if (configured) return;
  const renderer = new Renderer();

  // Captura bloques mermaid; resalta el resto con hljs.
  renderer.code = function (code: string, infostring: string | undefined): string {
    const lang = (infostring || '').trim().split(/\s+/)[0].toLowerCase();
    if (lang === 'mermaid') {
      const id = 'mermaid-' + mermaidCounter++;
      const encoded = encodeURIComponent(code);
      return `<div class="mermaid-block" data-mermaid="${encoded}" id="${id}"></div>`;
    }
    let highlighted: string;
    let used = lang;
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(code, { language: lang }).value;
      } else {
        const auto = hljs.highlightAuto(code);
        highlighted = auto.value;
        used = auto.language || '';
      }
    } catch {
      highlighted = escapeHtml(code);
    }
    return `<pre><button class="copy-code">Copiar</button><code class="hljs language-${used}">${highlighted}</code></pre>`;
  };

  // Headings con id (slug) y ancla.
  renderer.heading = function (text: string, level: number): string {
    const slug = slugify(stripTags(text));
    return (
      `<h${level} id="${slug}">${text}` +
      `<a class="heading-anchor" href="#${slug}" aria-label="Enlace">#</a></h${level}>`
    );
  };

  marked.setOptions({ renderer, gfm: true, breaks: false });
  configured = true;
}

// El frontmatter YAML es metadata, no contenido: sin sacarlo, marked lo toma
// como <hr> + setext heading y termina ensuciando el titulo, la TOC y el TTS.
// Se exige al menos una linea `clave: valor` para no comerse un `---` usado
// como separador al principio de un documento.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function stripFrontmatter(md: string): string {
  const m = FRONTMATTER.exec(md);
  if (!m) return md;
  return /^[A-Za-z_][\w.-]*[ \t]*:/m.test(m[1]) ? md.slice(m[0].length) : md;
}

// Markdown -> HTML sanitizado (string).
export function toSafeHtml(md: string): string {
  configureMarked();
  resetSlugs();
  mermaidCounter = 0;
  const raw = marked.parse(stripFrontmatter(md), { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ['foreignObject'],
    ADD_ATTR: ['data-mermaid', 'target'],
  });
}

// Documento al que pertenecen los diagramas, para poder abrirlos en su propia
// pestaña (/mermaid?path=…&i=…). Sin esto los controles de zoom siguen andando,
// pero no se ofrece el link (por ejemplo en la preview de Ajustes).
export interface MermaidCtx {
  path: string;
  app: string;
}

// Renderiza todos los .mermaid-block dentro de rootEl con el tema dado y les
// agrega zoom/arrastre, para que un diagrama grande no quede ilegible.
export async function renderMermaidIn(rootEl: HTMLElement, theme: string, ctx?: MermaidCtx): Promise<void> {
  const blocks = rootEl.querySelectorAll<HTMLElement>('.mermaid-block');
  if (!blocks.length) return;
  mermaid.initialize({ startOnLoad: false, theme: (theme as 'default') || 'default', securityLevel: 'loose' });
  for (const block of blocks) {
    const code = decodeURIComponent(block.getAttribute('data-mermaid') || '');
    const renderId = 'mmd-' + mermaidRenderSeq++;
    try {
      const { svg } = await mermaid.render(renderId, code);
      block.classList.remove('mermaid-error');
      mountMermaidViewer(block, svg, ctx);
    } catch (err) {
      block.classList.add('mermaid-error');
      block.textContent = 'Error en diagrama Mermaid:\n' + (err instanceof Error ? err.message : String(err));
    }
  }
}

// Arma el visor de un diagrama: viewport recortado + canvas transformable + barra
// de herramientas. Los listeners viven en nodos que se descartan al re-renderizar
// el documento, así que no hace falta limpiarlos a mano.
function mountMermaidViewer(block: HTMLElement, svgMarkup: string, ctx?: MermaidCtx): void {
  block.innerHTML = '';

  const viewport = document.createElement('div');
  viewport.className = 'mermaid-viewport';
  viewport.title = 'Arrastrá para mover · Ctrl + rueda para zoom · doble clic para ajustar';

  const canvas = document.createElement('div');
  canvas.className = 'mermaid-canvas';
  canvas.innerHTML = svgMarkup;
  viewport.appendChild(canvas);
  block.appendChild(viewport);

  const svg = canvas.querySelector('svg');
  const size = svg ? unlockSvgSize(svg) : null;

  // El marco toma la altura del diagrama ya ajustado al ancho disponible, con un
  // tope. Así uno chico no ocupa media pantalla y solo se recortan (y necesitan
  // zoom/arrastre) los que de verdad no entran.
  if (size) {
    const availW = viewport.clientWidth || block.clientWidth;
    const fitW = availW ? Math.min(1, availW / size.w) : 1;
    const capH = Math.min(620, Math.round(window.innerHeight * 0.6));
    viewport.style.height = `${Math.round(Math.max(120, Math.min(size.h * fitW, capH)))}px`;
  }

  const tools = document.createElement('div');
  tools.className = 'mermaid-tools no-print';

  const pz = attachPanZoom(viewport, canvas, { wheelNeedsModifier: true });

  tools.appendChild(toolButton('−', 'Alejar', () => pz.zoomOut()));
  tools.appendChild(toolButton('+', 'Acercar', () => pz.zoomIn()));
  tools.appendChild(toolButton('⤢', 'Ajustar al marco', () => pz.fit()));

  // El índice sale del id que puso el renderer (mermaid-N) y es estable por
  // documento, así que la pestaña dedicada se puede recargar y compartir.
  const index = Number((block.id || '').replace('mermaid-', ''));
  if (ctx?.path && Number.isFinite(index)) {
    const link = document.createElement('a');
    link.className = 'mermaid-tool';
    link.href = `/mermaid?path=${encodeURIComponent(ctx.path)}&i=${index}&app=${encodeURIComponent(ctx.app)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = 'Abrir en una pestaña dedicada';
    link.textContent = '↗';
    tools.appendChild(link);
  }

  block.appendChild(tools);
  requestAnimationFrame(() => pz.fit()); // esperar al layout para medir bien
}

function toolButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mermaid-tool';
  b.title = title;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

// Conecta los botones "Copiar" de los bloques de código dentro de rootEl.
export function attachCopyButtons(rootEl: HTMLElement): void {
  rootEl.querySelectorAll<HTMLButtonElement>('.copy-code').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.parentElement?.querySelector('code');
      if (!code) return;
      navigator.clipboard.writeText(code.textContent || '').then(() => {
        btn.textContent = '✓ Copiado';
        setTimeout(() => (btn.textContent = 'Copiar'), 1200);
      });
    });
  });
}
