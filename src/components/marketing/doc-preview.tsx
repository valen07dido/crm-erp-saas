import React, { useEffect, useRef } from 'react';
import type { DesignDoc } from '@/lib/marketing/types';
import { preloadDoc, renderDoc } from '@/lib/marketing/render';
import { cn } from '@/lib/utils';

/** Live, read-only render of a document at a given CSS width (template pickers, previews). */
export default function DocPreview({ doc, width, className }: { doc: DesignDoc; width: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = Math.round((width * doc.height) / doc.width);

  useEffect(() => {
    let alive = true;
    const draw = () => {
      const c = ref.current;
      if (!c || !alive) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      const ctx = c.getContext('2d');
      if (ctx) renderDoc(ctx, doc, (width * dpr) / doc.width);
    };
    draw();
    preloadDoc(doc).then(draw);
    return () => {
      alive = false;
    };
  }, [doc, width, height]);

  return <canvas ref={ref} style={{ width, height }} className={cn('block rounded-md', className)} />;
}
