import type { CampaignBrief, CampaignStatus, DesignSummary } from './types';

export const CAROUSEL_PREFIX = 'Carrusel · ';

export interface ProductionRow {
  key: keyof CampaignBrief['pieces'];
  label: string;
  done: number;
  approved: number;
  target: number;
}

/**
 * Production status of a campaign: pieces made vs pieces the brief asked for.
 * Carousels count once per series (slides share the "Carrusel · <title>" name prefix).
 * Reels count their cover only, until Reel Studio exists.
 */
export function production(brief: CampaignBrief, designs: Pick<DesignSummary, 'format' | 'status' | 'name'>[]): ProductionRow[] {
  const by = (f: string) => designs.filter((d) => d.format === f);
  const carousels = designs.filter((d) => d.name.startsWith(CAROUSEL_PREFIX));
  const series = new Map<string, boolean>();
  for (const d of carousels) {
    const title = d.name.slice(CAROUSEL_PREFIX.length).split(' · ')[0];
    series.set(title, (series.get(title) ?? true) && d.status === 'APPROVED');
  }
  const stories = by('story');
  const posts = by('post').concat(by('portrait').filter((d) => !d.name.startsWith(CAROUSEL_PREFIX)));
  const reels = by('reel-cover');
  const approved = (xs: { status: string }[]) => xs.filter((x) => x.status === 'APPROVED').length;
  return [
    { key: 'stories', label: 'Historias', done: stories.length, approved: approved(stories), target: brief.pieces.stories },
    { key: 'posts', label: 'Publicaciones', done: posts.length, approved: approved(posts), target: brief.pieces.posts },
    { key: 'carousels', label: 'Carruseles', done: series.size, approved: Array.from(series.values()).filter(Boolean).length, target: brief.pieces.carousels },
    { key: 'reels', label: 'Portadas de reel', done: reels.length, approved: approved(reels), target: brief.pieces.reels },
  ];
}

export function overallProgress(rows: ProductionRow[]): number {
  const target = rows.reduce((s, r) => s + r.target, 0);
  if (!target) return 0;
  return Math.min(1, rows.reduce((s, r) => s + Math.min(r.done, r.target), 0) / target);
}

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-accent text-muted-foreground' },
  ACTIVE: { label: 'Activa', cls: 'bg-primary/15 text-primary' },
  FINISHED: { label: 'Finalizada', cls: 'bg-secondary/15 text-secondary' },
};

export function formatRange(b: CampaignBrief): string {
  const f = (s: string) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '');
  if (!b.startDate && !b.endDate) return 'Sin fechas';
  return `${f(b.startDate) || '…'} → ${f(b.endDate) || '…'}`;
}
