import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { BrandKit, CampaignRecord, FormatId } from '@/lib/marketing/types';
import { FORMAT_LIST } from '@/lib/marketing/formats';
import { TEMPLATES, buildFromTemplate } from '@/lib/marketing/templates';
import { api, createDesign, shortName } from '@/lib/marketing/client';
import { alertMessage } from '@/lib/alerts';
import { cn } from '@/lib/utils';
import DocPreview from './doc-preview';
import { Btn, Field, Modal, Select, TextArea, TextInput } from './studio-ui';

export interface NewDesignDefaults {
  format?: FormatId;
  templateId?: string;
  headline?: string;
  body?: string;
  campaignId?: string | null;
}

export default function NewDesignModal({
  open,
  onClose,
  kit,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  kit: BrandKit;
  defaults?: NewDesignDefaults;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<FormatId>('story');
  const [templateId, setTemplateId] = useState('editorial');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Pick<CampaignRecord, 'id' | 'name'>[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormat(defaults?.format ?? 'story');
    setTemplateId(defaults?.templateId ?? 'editorial');
    setHeadline(defaults?.headline ?? 'Todo tu negocio en *un solo lugar*.');
    setBody(defaults?.body ?? '');
    setCampaignId(defaults?.campaignId ?? '');
    api<CampaignRecord[]>('/api/marketing/campaigns')
      .then((c) => setCampaigns(c.map(({ id, name }) => ({ id, name }))))
      .catch(() => setCampaigns([]));
  }, [open, defaults]);

  const previews = useMemo(
    () => TEMPLATES.map((t) => ({ t, doc: buildFromTemplate(t.id, format, { headline: headline || 'Titular', body }, kit) })),
    [format, headline, body, kit],
  );

  const create = async () => {
    setBusy(true);
    try {
      const { id } = await createDesign({
        name: shortName(headline || 'Nueva pieza'),
        templateId,
        format,
        content: { headline: headline || 'Titular', body },
        kit,
        campaignId: campaignId || null,
      });
      router.push(`/superadmin/marketing/editor/${id}`);
    } catch (e) {
      alertMessage((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva pieza" wide>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Field label="Formato">
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_LIST.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    format === f.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/50',
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-end justify-center">
                    <span
                      className="block rounded-[3px] border-2 border-current text-muted-foreground"
                      style={{ height: f.width === f.height ? 18 : 24, width: (f.width === f.height ? 18 : 24) * (f.width / f.height) }}
                    />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold">{f.short}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {f.width}×{f.height}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Titular" hint="Encerrá palabras entre *asteriscos* para resaltarlas.">
            <TextArea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={3} />
          </Field>
          <Field label="Texto (opcional)">
            <TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </Field>
          <Field label="Campaña">
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Sin campaña</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Plantilla</p>
          <div className="grid max-h-[58vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {previews.map(({ t, doc }) => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={cn('rounded-xl border p-2 text-left transition-colors', templateId === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40')}
              >
                <div className="flex justify-center rounded-lg bg-black/25 p-2">
                  <DocPreview doc={doc} width={format === 'post' ? 150 : format === 'portrait' ? 130 : 100} />
                </div>
                <p className="mt-2 text-xs font-semibold">{t.name}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>
              Cancelar
            </Btn>
            <Btn variant="primary" loading={busy} onClick={create}>
              Crear y editar
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
