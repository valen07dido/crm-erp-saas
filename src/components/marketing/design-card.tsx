import React, { useState } from 'react';
import Link from 'next/link';
import { Copy, Download, Trash2 } from 'lucide-react';
import type { DesignSummary } from '@/lib/marketing/types';
import { FORMATS } from '@/lib/marketing/formats';
import { deleteDesignById, duplicateDesignById, exportDesignById } from '@/lib/marketing/client';
import { alertMessage, confirmAction, toastSuccess } from '@/lib/alerts';
import { IconBtn, StatusPill } from './studio-ui';

export function DesignThumb({ d, className }: { d: Pick<DesignSummary, 'thumbnail' | 'format' | 'name'>; className?: string }) {
  const f = FORMATS[d.format];
  return (
    <div className={className} style={{ aspectRatio: `${f.width} / ${f.height}` }}>
      {d.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.thumbnail} alt={d.name} className="h-full w-full rounded-md object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-accent font-mono text-[10px] text-muted-foreground">{f.short}</div>
      )}
    </div>
  );
}

export default function DesignCard({ d, onChanged, showCampaign }: { d: DesignSummary; onChanged: () => void; showCampaign?: boolean }) {
  const [busy, setBusy] = useState(false);
  const f = FORMATS[d.format];
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toastSuccess(ok);
      onChanged();
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-muted-foreground/40">
      <Link href={`/superadmin/marketing/editor/${d.id}`} className="block bg-black/25 p-3">
        <DesignThumb d={d} className="mx-auto max-h-[300px]" />
      </Link>
      <div className="space-y-1.5 px-3 pb-3 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/superadmin/marketing/editor/${d.id}`} className="line-clamp-2 text-[13px] font-semibold leading-snug hover:text-primary">
            {d.name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={d.status} />
          <span className="font-mono text-[10px] text-muted-foreground">{f.short}</span>
        </div>
        {showCampaign && d.campaign ? <p className="truncate text-[11px] text-muted-foreground">{d.campaign.name}</p> : null}
      </div>
      <div className="absolute right-2 top-2 flex gap-0.5 rounded-lg border border-border bg-card/95 p-0.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconBtn label="Descargar PNG" disabled={busy} onClick={() => run(() => exportDesignById(d.id, 'png'))}>
          <Download className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Duplicar" disabled={busy} onClick={() => run(() => duplicateDesignById(d.id), 'Diseño duplicado')}>
          <Copy className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          label="Eliminar"
          disabled={busy}
          className="hover:text-destructive"
          onClick={async () => {
            if (await confirmAction(`¿Eliminar "${d.name}"? No se puede deshacer.`, 'Eliminar')) run(() => deleteDesignById(d.id), 'Diseño eliminado');
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    </div>
  );
}
