'use strict';
/* Núcleo de renderizado Markdown compartido: parseo + sanitización,
   resaltado de código, captura de diagramas Mermaid y utilidades.
   Depende de globals: marked, DOMPurify, hljs, mermaid. */
(function () {
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function stripTags(s) { return s.replace(/<[^>]*>/g, ''); }

  // Slugs únicos por documento para los anchors de los headings.
  let slugCounts = {};
  function resetSlugs() { slugCounts = {}; }
  function slugify(text) {
    let base = text.toLowerCase().trim()
      .replace(/[^\wÀ-ɏ\s-]/g, '')
      .replace(/\s+/g, '-');
    if (!base) base = 'section';
    if (slugCounts[base] != null) { slugCounts[base]++; base = base + '-' + slugCounts[base]; }
    else { slugCounts[base] = 0; }
    return base;
  }

  let mermaidCounter = 0;
  let mermaidRenderSeq = 0;

  function configureMarked() {
    const renderer = new marked.Renderer();

    // Captura bloques mermaid; resalta el resto con hljs.
    renderer.code = function (code, infostring) {
      const lang = (infostring || '').trim().split(/\s+/)[0].toLowerCase();
      if (lang === 'mermaid') {
        const id = 'mermaid-' + (mermaidCounter++);
        const encoded = encodeURIComponent(code);
        return `<div class="mermaid-block" data-mermaid="${encoded}" id="${id}"></div>`;
      }
      let highlighted, used = lang;
      try {
        if (lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(code, { language: lang }).value;
        } else {
          const auto = hljs.highlightAuto(code);
          highlighted = auto.value; used = auto.language || '';
        }
      } catch {
        highlighted = escapeHtml(code);
      }
      return `<pre><button class="copy-code">Copiar</button><code class="hljs language-${used}">${highlighted}</code></pre>`;
    };

    // Headings con id (slug) y ancla.
    renderer.heading = function (text, level) {
      const slug = slugify(stripTags(text));
      return `<h${level} id="${slug}">${text}` +
        `<a class="heading-anchor" href="#${slug}" aria-label="Enlace">#</a></h${level}>`;
    };

    marked.setOptions({ renderer, gfm: true, breaks: false, headerIds: false, mangle: false });
  }

  // Markdown -> HTML sanitizado (string).
  function toSafeHtml(md) {
    resetSlugs();
    mermaidCounter = 0;
    const raw = marked.parse(md);
    return DOMPurify.sanitize(raw, {
      ADD_TAGS: ['foreignObject'],
      ADD_ATTR: ['data-mermaid', 'target']
    });
  }

  // Renderiza todos los .mermaid-block dentro de rootEl con el tema dado.
  async function renderMermaidIn(rootEl, theme) {
    const blocks = rootEl.querySelectorAll('.mermaid-block');
    if (!blocks.length) return;
    mermaid.initialize({ startOnLoad: false, theme: theme || 'default', securityLevel: 'loose' });
    for (const block of blocks) {
      const code = decodeURIComponent(block.getAttribute('data-mermaid'));
      // id único global para evitar colisiones entre re-renders.
      const renderId = 'mmd-' + (mermaidRenderSeq++);
      try {
        const { svg } = await mermaid.render(renderId, code);
        block.innerHTML = svg;
        block.classList.remove('mermaid-error');
      } catch (err) {
        block.classList.add('mermaid-error');
        block.textContent = 'Error en diagrama Mermaid:\n' + (err && err.message ? err.message : err);
      }
    }
  }

  // Conecta los botones "Copiar" de los bloques de código dentro de rootEl.
  function attachCopyButtons(rootEl) {
    rootEl.querySelectorAll('.copy-code').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.parentElement.querySelector('code');
        navigator.clipboard.writeText(code.innerText).then(() => {
          btn.textContent = '✓ Copiado';
          setTimeout(() => (btn.textContent = 'Copiar'), 1200);
        });
      });
    });
  }

  window.MDCore = { escapeHtml, stripTags, resetSlugs, slugify, configureMarked, toSafeHtml, renderMermaidIn, attachCopyButtons };
})();
