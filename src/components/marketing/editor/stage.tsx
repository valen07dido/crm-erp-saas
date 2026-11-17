import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DesignDoc, Layer } from '@/lib/marketing/types';
import { FORMATS } from '@/lib/marketing/formats';
import { preloadDoc, renderDoc, type RenderResult } from '@/lib/marketing/render';
import { cn } from '@/lib/utils';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'e' | 'w';

interface DragState {
  kind: 'move' | 'resize';
  handle?: Handle;
  id: string;
  startX: number;
  startY: number;
  orig: Layer;
  origH: number;
}

const SNAP_PX = 7;

export interface StageProps {
  doc: DesignDoc;
  zoom: number | 'fit';
  selectedId: string | null;
  showSafe: boolean;
  onSelect: (id: string | null) => void;
  /** Transient updates while dragging; `onDragEnd` turns them into one undo step. */
  onLayerChange: (id: string, patch: Partial<Layer>) => void;
  onDragEnd: () => void;
  onRender?: (r: RenderResult) => void;
  onEditText?: (id: string) => void;
  onScaleChange?: (scale: number) => void;
}

export default function Stage({ doc, zoom, selectedId, showSafe, onSelect, onLayerChange, onDragEnd, onRender, onEditText, onScaleChange }: StageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [avail, setAvail] = useState({ w: 600, h: 800 });
  const [textHeights, setTextHeights] = useState<Record<string, number>>({});
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const drag = useRef<DragState | null>(null);

  const fmt = FORMATS[doc.format];
  const fitScale = Math.min((avail.w - 64) / doc.width, (avail.h - 64) / doc.height);
  const scale = Math.max(0.05, zoom === 'fit' ? fitScale : zoom);

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw (and re-draw once images/fonts finish loading).
  useEffect(() => {
    let alive = true;
    let raf = 0;
    const draw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const c = canvasRef.current;
        if (!c || !alive) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(doc.width * scale * dpr);
        const h = Math.round(doc.height * scale * dpr);
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        const r = renderDoc(ctx, doc, scale * dpr);
        setTextHeights(r.textHeights);
        onRender?.(r);
      });
    };
    draw();
    preloadDoc(doc).then(() => alive && draw());
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [doc, scale, onRender]);

  const layerH = useCallback((l: Layer) => (l.type === 'text' ? textHeights[l.id] ?? l.h : l.h), [textHeights]);

  // ─── Drag / resize with snapping ─────────────────────────────────────────

  const snap = useCallback(
    (value: number, size: number, targets: number[]): { v: number; guide: number | null } => {
      const tol = SNAP_PX / scale;
      const candidates = [
        { edge: value, off: 0 },
        { edge: value + size / 2, off: size / 2 },
        { edge: value + size, off: size },
      ];
      let best: { v: number; guide: number; d: number } | null = null;
      for (const c of candidates) {
        for (const t of targets) {
          const d = Math.abs(c.edge - t);
          if (d <= tol && (!best || d < best.d)) best = { v: t - c.off, guide: t, d };
        }
      }
      return best ? { v: best.v, guide: best.guide } : { v: value, guide: null };
    },
    [scale],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / scale;
      const dy = (e.clientY - d.startY) / scale;
      const o = d.orig;
      if (d.kind === 'move') {
        const vx = [0, fmt.safe.left, doc.width / 2, doc.width - fmt.safe.right, doc.width];
        const hy = [0, fmt.safe.top, doc.height / 2, doc.height - fmt.safe.bottom, doc.height];
        const sx = e.altKey ? { v: o.x + dx, guide: null } : snap(o.x + dx, o.w, vx);
        const sy = e.altKey ? { v: o.y + dy, guide: null } : snap(o.y + dy, d.origH, hy);
        setGuides({ v: sx.guide !== null ? [sx.guide] : [], h: sy.guide !== null ? [sy.guide] : [] });
        onLayerChange(d.id, { x: Math.round(sx.v), y: Math.round(sy.v) });
        return;
      }
      const h = d.handle!;
      const left = h === 'nw' || h === 'sw' || h === 'w';
      const top = h === 'nw' || h === 'ne';
      const w = Math.max(20, o.w + (left ? -dx : dx));
      if (h === 'e' || h === 'w') {
        onLayerChange(d.id, { w: Math.round(w), x: Math.round(left ? o.x + o.w - w : o.x) });
        return;
      }
      if (o.type === 'text') {
        // Corner-dragging text scales it (like a design tool), keeping the box proportions.
        const k = w / o.w;
        const patch: Partial<Layer> = { w: Math.round(w), size: Math.max(8, Math.round(o.size * k)) } as Partial<Layer>;
        patch.x = Math.round(left ? o.x + o.w - w : o.x);
        if (top) patch.y = Math.round(o.y + d.origH - d.origH * k);
        onLayerChange(d.id, patch);
        return;
      }
      let hh = Math.max(20, o.h + (top ? -dy : dy));
      const lockAspect = (o.type === 'image' && o.role === 'logo' && o.aspect) || e.shiftKey;
      if (lockAspect) {
        const ratio = o.type === 'image' && o.aspect ? o.aspect : o.w / o.h;
        hh = w / ratio;
      }
      if (!lockAspect && Math.abs(hh - o.h) < 0.5) hh = o.h;
      onLayerChange(d.id, {
        w: Math.round(w),
        h: Math.round(hh),
        x: Math.round(left ? o.x + o.w - w : o.x),
        y: Math.round(top ? o.y + o.h - hh : o.y),
      });
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      setGuides({ v: [], h: [] });
      onDragEnd();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [scale, snap, onLayerChange, onDragEnd, doc.width, doc.height, fmt]);

  const startDrag = (e: React.PointerEvent, l: Layer, kind: 'move' | 'resize', handle?: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(l.id);
    if (l.locked) return;
    drag.current = { kind, handle, id: l.id, startX: e.clientX, startY: e.clientY, orig: { ...l }, origH: layerH(l) };
  };

  const W = doc.width * scale;
  const H = doc.height * scale;
  const s = fmt.safe;

  return (
    <div
      ref={wrapRef}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:22px_22px]"
      onPointerDown={() => onSelect(null)}
    >
      <div className="relative m-8 shrink-0 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]" style={{ width: W, height: H }}>
        <canvas ref={canvasRef} style={{ width: W, height: H }} className="block" />

        {showSafe && (
          <div className="pointer-events-none absolute inset-0">
            {[
              { left: 0, top: 0, width: W, height: s.top * scale },
              { left: 0, top: H - s.bottom * scale, width: W, height: s.bottom * scale },
              { left: 0, top: s.top * scale, width: s.left * scale, height: H - (s.top + s.bottom) * scale },
              { left: W - s.right * scale, top: s.top * scale, width: s.right * scale, height: H - (s.top + s.bottom) * scale },
            ].map((r, i) => (
              <div key={i} className="absolute bg-[repeating-linear-gradient(135deg,rgba(224,117,117,0.16)_0_6px,transparent_6px_12px)]" style={r} />
            ))}
            <div
              className="absolute border border-dashed border-[#E07575]/70"
              style={{ left: s.left * scale, top: s.top * scale, width: W - (s.left + s.right) * scale, height: H - (s.top + s.bottom) * scale }}
            />
          </div>
        )}

        {guides.v.map((g) => (
          <div key={`v${g}`} className="pointer-events-none absolute top-0 h-full w-px bg-[#D6F36A]" style={{ left: g * scale }} />
        ))}
        {guides.h.map((g) => (
          <div key={`h${g}`} className="pointer-events-none absolute left-0 h-px w-full bg-[#D6F36A]" style={{ top: g * scale }} />
        ))}

        {/* Interaction boxes, top-most layer last so it wins the click. */}
        {doc.layers.map((l) => {
          if (l.hidden) return null;
          const selected = l.id === selectedId;
          const h = layerH(l);
          return (
            <div
              key={l.id}
              onPointerDown={(e) => startDrag(e, l, 'move')}
              onDoubleClick={() => l.type === 'text' && onEditText?.(l.id)}
              className={cn(
                'absolute',
                l.locked ? 'cursor-default' : 'cursor-move',
                selected ? 'outline outline-2 outline-[#D6F36A]' : 'hover:outline hover:outline-1 hover:outline-[#D6F36A]/60',
              )}
              style={{
                left: l.x * scale,
                top: l.y * scale,
                width: l.w * scale,
                height: Math.max(6, h * scale),
                transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
              }}
            >
              {selected && !l.locked && (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as Handle[]).map((hd) => (
                    <span
                      key={hd}
                      onPointerDown={(e) => startDrag(e, l, 'resize', hd)}
                      className="absolute h-3 w-3 rounded-sm border-2 border-[#D6F36A] bg-[#20252B]"
                      style={{
                        left: hd.includes('w') ? -6 : undefined,
                        right: hd.includes('e') ? -6 : undefined,
                        top: hd.includes('n') ? -6 : undefined,
                        bottom: hd.includes('s') ? -6 : undefined,
                        cursor: hd === 'nw' || hd === 'se' ? 'nwse-resize' : 'nesw-resize',
                      }}
                    />
                  ))}
                  {!(l.type === 'image' && l.role === 'logo') &&
                    (['e', 'w'] as Handle[]).map((hd) => (
                      <span
                        key={hd}
                        onPointerDown={(e) => startDrag(e, l, 'resize', hd)}
                        className="absolute top-1/2 h-5 w-2 -translate-y-1/2 rounded-sm border-2 border-[#D6F36A] bg-[#20252B]"
                        style={{ left: hd === 'w' ? -4 : undefined, right: hd === 'e' ? -4 : undefined, cursor: 'ew-resize' }}
                      />
                    ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
