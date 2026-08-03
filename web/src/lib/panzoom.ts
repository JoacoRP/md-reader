// Zoom + arrastre sobre un contenido dentro de un viewport recortado. Se usa en
// los diagramas Mermaid: inline en el documento y en la pestaña dedicada.
// El contenido se mueve con un transform (translate + scale), así que el DOM de
// adentro no se toca y el SVG no se re-renderiza al hacer zoom.

export interface PanZoomOptions {
  // Si es true, la rueda sola scrollea la página y solo hace zoom con Ctrl/Cmd.
  // Inline conviene true (no secuestrar el scroll); en la pestaña dedicada, false.
  wheelNeedsModifier?: boolean;
  min?: number;
  max?: number;
  onChange?: (scale: number) => void;
}

export interface PanZoomHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  /** Encuadra el contenido en el viewport (sin agrandar más allá de 1). */
  fit: () => void;
  getScale: () => number;
  destroy: () => void;
}

const STEP = 1.25;

export function attachPanZoom(
  viewport: HTMLElement,
  canvas: HTMLElement,
  opts: PanZoomOptions = {},
): PanZoomHandle {
  const min = opts.min ?? 0.1;
  const max = opts.max ?? 8;
  const wheelNeedsModifier = opts.wheelNeedsModifier ?? true;

  let scale = 1;
  let x = 0;
  let y = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;

  function apply() {
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    opts.onChange?.(scale);
  }

  function clamp(s: number) {
    return Math.min(max, Math.max(min, s));
  }

  // Zoom manteniendo fijo el punto (cx, cy) en coordenadas del viewport: es lo
  // que hace que la rueda haga foco donde está el cursor y no en el centro.
  function zoomAt(next: number, cx: number, cy: number) {
    const s = clamp(next);
    if (s === scale) return;
    x = cx - (cx - x) * (s / scale);
    y = cy - (cy - y) * (s / scale);
    scale = s;
    apply();
  }

  function zoomCenter(next: number) {
    const r = viewport.getBoundingClientRect();
    zoomAt(next, r.width / 2, r.height / 2);
  }

  function onWheel(e: WheelEvent) {
    if (wheelNeedsModifier && !e.ctrlKey && !e.metaKey) return; // deja scrollear la página
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    const factor = e.deltaY < 0 ? STEP : 1 / STEP;
    zoomAt(scale * factor, e.clientX - r.left, e.clientY - r.top);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX - x;
    startY = e.clientY - y;
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('is-grabbing');
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    x = e.clientX - startX;
    y = e.clientY - startY;
    apply();
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* el puntero ya se soltó */
    }
    viewport.classList.remove('is-grabbing');
  }

  function fit() {
    // El canvas se mide sin transform para conocer su tamaño natural.
    const prev = canvas.style.transform;
    canvas.style.transform = 'none';
    const cw = canvas.scrollWidth;
    const ch = canvas.scrollHeight;
    canvas.style.transform = prev;

    const r = viewport.getBoundingClientRect();
    if (!cw || !ch || !r.width || !r.height) return;

    // Solo achica para que entre; no agranda diagramas chicos.
    scale = clamp(Math.min(1, Math.min(r.width / cw, r.height / ch)));
    x = (r.width - cw * scale) / 2;
    y = (r.height - ch * scale) / 2;
    apply();
  }

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  viewport.addEventListener('dblclick', fit);

  return {
    zoomIn: () => zoomCenter(scale * STEP),
    zoomOut: () => zoomCenter(scale / STEP),
    fit,
    getScale: () => scale,
    destroy: () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('dblclick', fit);
    },
  };
}

// Mermaid emite el SVG con `max-width` inline y width="100%", que es justo lo que
// achica los diagramas grandes hasta volverlos ilegibles. Para el zoom necesitamos
// su tamaño natural: lo tomamos del viewBox y lo fijamos en píxeles.
export function unlockSvgSize(svg: SVGElement): { w: number; h: number } | null {
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  let w = vb.length === 4 && vb[2] > 0 ? vb[2] : 0;
  let h = vb.length === 4 && vb[3] > 0 ? vb[3] : 0;
  if (!w || !h) {
    const r = svg.getBoundingClientRect();
    w = r.width;
    h = r.height;
  }
  if (!w || !h) return null;
  svg.style.maxWidth = 'none';
  svg.style.width = `${w}px`;
  svg.style.height = `${h}px`;
  return { w, h };
}
