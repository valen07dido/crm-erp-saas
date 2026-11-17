import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Images, Plus } from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import DesignCard from '@/components/marketing/design-card';
import NewDesignModal from '@/components/marketing/new-design-modal';
import { Btn, EmptyState, Segmented, Select, Spinner } from '@/components/marketing/studio-ui';
import type { CampaignRecord, DesignStatus, DesignSummary, FormatId } from '@/lib/marketing/types';
import { isFormatId } from '@/lib/marketing/formats';
import { api, useBrandKit } from '@/lib/marketing/client';
import { alertMessage } from '@/lib/alerts';

type FormatFilter = 'all' | FormatId;

export default function DesignsPage() {
  const router = useRouter();
  const { kit } = useBrandKit();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [campaigns, setCampaigns] = useState<Pick<CampaignRecord, 'id' | 'name'>[]>([]);
  const [format, setFormat] = useState<FormatFilter>('all');
  const [status, setStatus] = useState<'all' | DesignStatus>('all');
  const [campaign, setCampaign] = useState('all');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const f = router.query.format;
    if (isFormatId(f)) setFormat(f);
    if (router.query.new === '1') setCreating(true);
  }, [router.query.format, router.query.new]);

  const load = useCallback(() => {
    api<DesignSummary[]>('/api/marketing/designs')
      .then(setDesigns)
      .catch((e) => {
        alertMessage(e.message);
        setDesigns([]);
      });
  }, []);
  useEffect(() => {
    load();
    api<CampaignRecord[]>('/api/marketing/campaigns')
      .then((c) => setCampaigns(c.map(({ id, name }) => ({ id, name }))))
      .catch(() => undefined);
  }, [load]);

  const modalDefaults = useMemo(() => (format !== 'all' ? { format } : undefined), [format]);

  const list = useMemo(
    () =>
      (designs ?? []).filter(
        (d) =>
          (format === 'all' || d.format === format) &&
          (status === 'all' || d.status === status) &&
          (campaign === 'all' || (campaign === 'none' ? !d.campaignId : d.campaignId === campaign)),
      ),
    [designs, format, status, campaign],
  );

  return (
    <StudioLayout
      title="Diseños"
      subtitle="Historias, publicaciones, carruseles y portadas de reel. Abrí cualquiera para editarla."
      actions={
        <Btn variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nueva pieza
        </Btn>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          value={format}
          onChange={setFormat}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'story', label: 'Historias' },
            { value: 'post', label: 'Posts' },
            { value: 'portrait', label: 'Portrait' },
            { value: 'reel-cover', label: 'Portadas reel' },
          ]}
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | DesignStatus)} className="h-9 w-40">
          <option value="all">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="REVIEW">En revisión</option>
          <option value="APPROVED">Aprobado</option>
        </Select>
        <Select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="h-9 w-56">
          <option value="all">Todas las campañas</option>
          <option value="none">Sin campaña</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{list.length} piezas</span>
      </div>

      {!designs ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Images className="h-5 w-5" />}
          title={designs.length ? 'Nada con esos filtros' : 'Todavía no hay diseños'}
          text="Elegí un formato y una plantilla; después podés cambiar todo en el editor."
          action={
            <Btn variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nueva pieza
            </Btn>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {list.map((d) => (
            <DesignCard key={d.id} d={d} onChanged={load} showCampaign />
          ))}
        </div>
      )}

      <NewDesignModal open={creating} onClose={() => setCreating(false)} kit={kit} defaults={modalDefaults} />
    </StudioLayout>
  );
}
