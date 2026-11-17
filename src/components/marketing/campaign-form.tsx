import React, { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { AudienceKey, CampaignBrief } from '@/lib/marketing/types';
import { AUDIENCES, CHANNELS, FEATURES } from '@/lib/marketing/brand';
import { cn } from '@/lib/utils';
import { Btn, Field, Select, TextArea, TextInput } from './studio-ui';

export const EMPTY_BRIEF: CampaignBrief = {
  objective: '',
  audience: 'general',
  audienceNotes: '',
  mainMessage: '',
  offer: '',
  channels: ['Instagram'],
  startDate: '',
  endDate: '',
  features: [],
  pieces: { stories: 5, posts: 3, carousels: 1, reels: 1 },
};

function Chip({ active, onClick, children, warn }: { active: boolean; onClick: () => void; children: React.ReactNode; warn?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors',
        active ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
        warn && !active && 'border-dashed',
      )}
    >
      {children}
    </button>
  );
}

export default function CampaignForm({
  initialName = '',
  initialBrief = EMPTY_BRIEF,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  initialBrief?: CampaignBrief;
  submitLabel: string;
  onSubmit: (name: string, brief: CampaignBrief) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [b, setB] = useState<CampaignBrief>(initialBrief);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<CampaignBrief>) => setB((x) => ({ ...x, ...p }));
  const toggle = (key: 'channels' | 'features', v: string) => set({ [key]: b[key].includes(v) ? b[key].filter((x) => x !== v) : [...b[key], v] });
  const unconfirmed = FEATURES.filter((f) => f.needsConfirmation && b.features.includes(f.key));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit(name.trim(), b);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre de la campaña">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Lanzamiento página pública" required maxLength={120} />
        </Field>
        <Field label="Objetivo">
          <TextInput value={b.objective} onChange={(e) => set({ objective: e.target.value })} placeholder="Ej.: Conseguir pedidos de demo por WhatsApp" />
        </Field>
        <Field label="Público objetivo">
          <Select value={b.audience} onChange={(e) => set({ audience: e.target.value as AudienceKey })}>
            {AUDIENCES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Detalle del público (opcional)">
          <TextInput value={b.audienceNotes} onChange={(e) => set({ audienceNotes: e.target.value })} placeholder="Ej.: almacenes de barrio de Rosario" />
        </Field>
      </div>
      <Field label="Mensaje principal" hint="La idea que tiene que quedar. Podés resaltar palabras con *asteriscos*.">
        <TextInput value={b.mainMessage} onChange={(e) => set({ mainMessage: e.target.value })} placeholder="Ej.: Tu negocio, *ordenado* en un solo lugar." />
      </Field>
      <Field label="Propuesta comercial" hint="Solo condiciones reales y confirmadas. El Studio nunca inventa precios, descuentos ni cupos: si lo dejás vacío, las piezas no mencionan condiciones.">
        <TextArea value={b.offer} onChange={(e) => set({ offer: e.target.value })} rows={2} placeholder="Ej.: (dejar vacío si no hay una propuesta confirmada)" />
      </Field>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Funcionalidades foco</p>
        <div className="flex flex-wrap gap-1.5">
          {FEATURES.map((f) => (
            <Chip key={f.key} active={b.features.includes(f.key)} onClick={() => toggle('features', f.key)} warn={f.needsConfirmation}>
              {f.name}
              {f.needsConfirmation ? <span className="text-warning">·?</span> : null}
            </Chip>
          ))}
        </div>
        {unconfirmed.length > 0 && (
          <p className="mt-2 flex gap-1.5 text-xs text-warning">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            &quot;{unconfirmed.map((f) => f.name).join(', ')}&quot; figura en el brief comercial pero no lo encontré en el sistema actual. Confirmalo antes de publicar.
          </p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Canales</p>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <Chip key={c} active={b.channels.includes(c)} onClick={() => toggle('channels', c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Desde">
          <TextInput type="date" value={b.startDate} onChange={(e) => set({ startDate: e.target.value })} className="w-40" />
        </Field>
        <Field label="Hasta">
          <TextInput type="date" value={b.endDate} onChange={(e) => set({ endDate: e.target.value })} className="w-40" />
        </Field>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Piezas necesarias</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['stories', 'Historias'],
              ['posts', 'Publicaciones'],
              ['carousels', 'Carruseles'],
              ['reels', 'Reels'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <input
                type="number"
                min={0}
                max={50}
                value={b.pieces[k]}
                onChange={(e) => set({ pieces: { ...b.pieces, [k]: Math.max(0, Math.min(50, parseInt(e.target.value || '0', 10))) } })}
                className="w-14 bg-transparent text-right font-mono text-sm focus:outline-none"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Btn type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Btn>
        <Btn type="submit" variant="primary" loading={busy} disabled={!name.trim()}>
          {submitLabel}
        </Btn>
      </div>
    </form>
  );
}
