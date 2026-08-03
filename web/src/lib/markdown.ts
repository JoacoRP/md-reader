// Núcleo de renderizado Markdown (port de public/md-core.js): parseo +
// sanitización, resaltado de código, captura de diagramas Mermaid y utilidades.
// Antes dependía de globals (marked, DOMPurify, hljs, mermaid); ahora son imports
// que Vite bundlea. highlight.js/lib/common = build con los lenguajes habituales
// (equivalente al highlight.min.js vendoreado).
import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import mermaid from 'mermaid';

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

// Renderiza todos los .mermaid-block dentro de rootEl con el tema dado.
export async function renderMermaidIn(rootEl: HTMLElement, theme: string): Promise<void> {
  const blocks = rootEl.querySelectorAll<HTMLElement>('.mermaid-block');
  if (!blocks.length) return;
  mermaid.initialize({ startOnLoad: false, theme: (theme as 'default') || 'default', securityLevel: 'loose' });
  for (const block of blocks) {
    const code = decodeURIComponent(block.getAttribute('data-mermaid') || '');
    const renderId = 'mmd-' + mermaidRenderSeq++;
    try {
      const { svg } = await mermaid.render(renderId, code);
      block.innerHTML = svg;
      block.classList.remove('mermaid-error');
    } catch (err) {
      block.classList.add('mermaid-error');
      block.textContent = 'Error en diagrama Mermaid:\n' + (err instanceof Error ? err.message : String(err));
    }
  }
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
