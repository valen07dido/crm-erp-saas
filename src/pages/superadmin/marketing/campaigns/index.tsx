import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Megaphone, Plus } from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import CampaignForm from '@/components/marketing/campaign-form';
import ProductionBars from '@/components/marketing/production-bars';
import { DesignThumb } from '@/components/marketing/design-card';
import { Btn, EmptyState, Modal, Segmented, Spinner } from '@/components/marketing/studio-ui';
import type { CampaignBrief, CampaignRecord, CampaignStatus } from '@/lib/marketing/types';
import { CAMPAIGN_STATUS, formatRange } from '@/lib/marketing/production';
import { AUDIENCE_MAP } from '@/lib/marketing/brand';
import { generatePack, newSeed } from '@/lib/marketing/copy';
import { production, overallProgress } from '@/lib/marketing/production';
import { api, useBrandKit } from '@/lib/marketing/client';
import { alertMessage } from '@/lib/alerts';
import { cn } from '@/lib/utils';

export default function CampaignsPage() {
  const router = useRouter();
  const { kit } = useBrandKit();
  const [campaigns, setCampaigns] = useState<CampaignRecord[] | null>(null);
  const [filter, setFilter] = useState<'all' | CampaignStatus>('all');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<CampaignRecord[]>('/api/marketing/campaigns')
      .then(setCampaigns)
      .catch((e) => {
        alertMessage(e.message);
        setCampaigns([]);
      });
  }, []);
  useEffect(() => {
    load();
    if (router.query.new === '1') setCreating(true);
  }, [load, router.query.new]);

  const create = async (name: string, brief: CampaignBrief) => {
    try {
      const content = generatePack(name, brief, newSeed(), { cta: kit.cta, whatsapp: kit.whatsapp });
      const c = await api<CampaignRecord>('/api/marketing/campaigns', { method: 'POST', json: { name, brief, content, status: 'ACTIVE' } });
      router.push(`/superadmin/marketing/campaigns/${c.id}`);
    } catch (e) {
      alertMessage((e as Error).message);
    }
  };

  const list = (campaigns ?? []).filter((c) => filter === 'all' || c.status === filter);

  return (
    <StudioLayout
      title="Campañas"
      subtitle="Cada campaña reúne el brief, el paquete creativo (concepto, titulares, guiones…) y las piezas que se producen a partir de él."
      actions={
        <Btn variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nueva campaña
        </Btn>
      }
    >
      <div className="mb-5">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'ACTIVE', label: 'Activas' },
            { value: 'DRAFT', label: 'Borradores' },
            { value: 'FINISHED', label: 'Finalizadas' },
          ]}
        />
      </div>

      {!campaigns ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title={campaigns.length ? 'No hay campañas con ese estado' : 'Todavía no hay campañas'}
          text="Definí objetivo, público y mensaje. El Studio arma el concepto, titulares, copys, historias, carruseles y guiones para empezar a producir."
          action={
            <Btn variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Crear la primera
            </Btn>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((c) => {
            const rows = production(c.brief, c.designs ?? []);
            const pct = overallProgress(rows);
            const st = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.DRAFT;
            return (
              <Link key={c.id} href={`/superadmin/marketing/campaigns/${c.id}`} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>{st.label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{formatRange(c.brief)}</span>
                    </div>
                    <h3 className="truncate font-heading text-lg font-bold tracking-tight group-hover:text-primary">{c.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {c.brief.objective || c.content?.concept.title || 'Sin objetivo definido'} · {AUDIENCE_MAP[c.brief.audience]?.label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-2xl font-bold">{Math.round(pct * 100)}%</p>
                    <p className="text-[11px] text-muted-foreground">producido</p>
                  </div>
                </div>
                <div className="mt-4">
                  <ProductionBars rows={rows} compact />
                </div>
                {(c.designs?.length ?? 0) > 0 && (
                  <div className="mt-4 flex gap-2 overflow-hidden">
                    {c.designs!.slice(0, 8).map((d) => (
                      <DesignThumb key={d.id} d={d} className="h-16 shrink-0" />
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva campaña" wide>
        <CampaignForm submitLabel="Crear y generar paquete creativo" onSubmit={create} onCancel={() => setCreating(false)} />
      </Modal>
    </StudioLayout>
  );
}
