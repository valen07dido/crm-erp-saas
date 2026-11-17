import React from 'react';
import type { ProductionRow } from '@/lib/marketing/production';
import { cn } from '@/lib/utils';

export default function ProductionBars({ rows, compact }: { rows: ProductionRow[]; compact?: boolean }) {
  const visible = rows.filter((r) => r.target > 0 || r.done > 0);
  if (!visible.length) return <p className="text-xs text-muted-foreground">Sin piezas definidas en el brief.</p>;
  return (
    <div className={cn('grid gap-x-5', compact ? 'grid-cols-2 gap-y-2' : 'gap-y-3 sm:grid-cols-2')}>
      {visible.map((r) => {
        const pct = r.target ? Math.min(1, r.done / r.target) : 1;
        const apr = r.target ? Math.min(1, r.approved / r.target) : 0;
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-mono">
                {r.done}
                <span className="text-muted-foreground">/{r.target}</span>
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-accent">
              <div className="absolute inset-y-0 left-0 rounded-full bg-secondary" style={{ width: `${pct * 100}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${apr * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
