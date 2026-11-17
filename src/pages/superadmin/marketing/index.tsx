import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  CalendarDays,
  Clapperboard,
  Download,
  FileText,
  GalleryHorizontal,
  ImagePlus,
  Images,
  Megaphone,
  Palette,
  PenLine,
  Plus,
  RectangleVertical,
  Square,
} from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import ProductionBars from '@/components/marketing/production-bars';
import { DesignThumb } from '@/components/marketing/design-card';
import { Btn, Kicker, Panel, Spinner, StatusPill } from '@/components/marketing/studio-ui';
import type { AssetRecord, CampaignRecord, DesignSummary } from '@/lib/marketing/types';
import { FORMATS } from '@/lib/marketing/formats';
import { CAMPAIGN_STATUS, formatRange, overallProgress, production } from '@/lib/marketing/production';
import { api } from '@/lib/marketing/client';
import { cn } from '@/lib/utils';

const MODULES = [
  { label: 'Campañas', href: '/superadmin/marketing/campaigns', icon: Megaphone, text: 'Brief, concepto y paquete creativo' },
  { label: 'Historias', href: '/superadmin/marketing/designs?format=story', icon: RectangleVertical, text: '1080 × 1920' },
  { label: 'Publicaciones', href: '/superadmin/marketing/designs?format=post', icon: Square, text: '1080 × 1080 y 1080 × 1350' },
  { label: 'Carruseles', href: '/superadmin/marketing/designs?format=portrait', icon: GalleryHorizontal, text: 'Series numeradas' },
  { label: 'Guiones', href: '/superadmin/marketing/copy?kind=guion', icon: FileText, text: 'Reels con escenas y tiempos' },
  { label: 'Textos', href: '/superadmin/marketing/copy', icon: PenLine, text: 'Titulares, copys, CTA, WhatsApp' },
  { label: 'Biblioteca', href: '/superadmin/marketing/brand', icon: Palette, text: 'Logos, capturas, colores' },
  { label: 'Exportar', href: '/superadmin/marketing/exports', icon: Download, text: 'PNG, JPG, ZIP y PDF' },
];

const NEXT = [
  { label: 'Reel Studio', icon: Clapperboard, text: 'Línea de tiempo, subtítulos y MP4' },
  { label: 'Promociones', icon: BadgePercent, text: 'Promos con vigencia y condiciones reales' },
  { label: 'Calendario', icon: CalendarDays, text: 'Agenda mensual y estados de publicación' },
];

export default function StudioHome() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[] | null>(null);
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [shots, setShots] = useState<number | null>(null);

  useEffect(() => {
    api<CampaignRecord[]>('/api/marketing/campaigns').then(setCampaigns).catch(() => setCampaigns([]));
    api<DesignSummary[]>('/api/marketing/designs').then(setDesigns).catch(() => setDesigns([]));
    api<AssetRecord[]>('/api/marketing/assets?category=screenshot').then((a) => setShots(a.length)).catch(() => setShots(0));
  }, []);

  const active = (campaigns ?? []).filter((c) => c.status === 'ACTIVE');
  const stat = (s: DesignSummary['status']) => designs.filter((d) => d.status === s).length;
  const kpis = [
    { label: 'Campañas activas', value: active.length },
    { label: 'Piezas en borrador', value: stat('DRAFT') },
    { label: 'En revisión', value: stat('REVIEW') },
    { label: 'Aprobadas', value: stat('APPROVED') },
  ];

  return (
    <StudioLayout
      title="Fábrica de contenido"
      subtitle="Campañas, piezas y textos para vender WALTI todas las semanas, con la identidad de marca y solo información verificada."
      actions={
        <>
          <Link href="/superadmin/marketing/designs?new=1">
            <Btn variant="outline">
              <ImagePlus className="h-4 w-4" /> Nueva pieza
            </Btn>
          </Link>
          <Link href="/superadmin/marketing/campaigns?new=1">
            <Btn variant="primary">
              <Plus className="h-4 w-4" /> Nueva campaña
            </Btn>
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={cn('rounded-xl border border-border p-5', i === 0 ? 'bg-primary text-primary-foreground' : 'bg-card')}>
            <p className={cn('text-xs', i === 0 ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{k.label}</p>
            <p className="mt-2 font-heading text-4xl font-extrabold tracking-tight">{campaigns ? k.value : '—'}</p>
          </div>
        ))}
      </div>

      {shots === 0 && (
        <Link href="/superadmin/marketing/brand" className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-5 py-4 text-sm">
          <span>
            <span className="font-semibold">Primer paso: subí capturas reales de WALTI.</span>{' '}
            <span className="text-muted-foreground">Las plantillas de pantalla y celular las necesitan para mostrar el sistema de verdad.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
        </Link>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel title="Campañas activas" action={<Link href="/superadmin/marketing/campaigns" className="text-xs text-muted-foreground hover:text-foreground">Ver todas</Link>}>
          {!campaigns ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : active.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No hay campañas activas.{' '}
              <Link href="/superadmin/marketing/campaigns?new=1" className="text-primary underline">
                Crear una
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {active.slice(0, 5).map((c) => {
                const rows = production(c.brief, c.designs ?? []);
                return (
                  <li key={c.id}>
                    <Link href={`/superadmin/marketing/campaigns/${c.id}`} className="grid gap-4 px-5 py-4 hover:bg-accent/30 md:grid-cols-[1fr_1.2fr_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-heading font-semibold">{c.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          <span className={cn('mr-2 rounded-full px-1.5 py-px', CAMPAIGN_STATUS[c.status].cls)}>{CAMPAIGN_STATUS[c.status].label}</span>
                          {formatRange(c.brief)}
                        </p>
                      </div>
                      <ProductionBars rows={rows} compact />
                      <p className="font-heading text-xl font-bold md:text-right">{Math.round(overallProgress(rows) * 100)}%</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Últimas piezas" action={<Link href="/superadmin/marketing/designs" className="text-xs text-muted-foreground hover:text-foreground">Ver todas</Link>}>
          {designs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Todavía no hay piezas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {designs.slice(0, 6).map((d) => (
                <li key={d.id}>
                  <Link href={`/superadmin/marketing/editor/${d.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/30">
                    <DesignThumb d={d} className="h-12 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{FORMATS[d.format].short}</p>
                    </div>
                    <StatusPill status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-8">
        <Kicker className="mb-3">Módulos</Kicker>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.label} href={m.href} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60">
                <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                <p className="mt-3 font-heading text-sm font-semibold">{m.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.text}</p>
              </Link>
            );
          })}
          {NEXT.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-xl border border-dashed border-border p-4 opacity-60">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 flex items-center gap-2 font-heading text-sm font-semibold">
                  {m.label}
                  <span className="rounded bg-accent px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Próxima etapa</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.text}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Images className="h-3.5 w-3.5" /> El Studio prepara y exporta las piezas. La publicación en Instagram y Facebook se hace a mano: no hay integración automática.
        </p>
      </div>
    </StudioLayout>
  );
}
