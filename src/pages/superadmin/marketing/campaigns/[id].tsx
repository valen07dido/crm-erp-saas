import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Check, Clapperboard, Copy, LayoutGrid, Pencil, Plus, RefreshCw, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import CampaignForm from '@/components/marketing/campaign-form';
import ProductionBars from '@/components/marketing/production-bars';
import DesignCard from '@/components/marketing/design-card';
import NewDesignModal, { type NewDesignDefaults } from '@/components/marketing/new-design-modal';
import { Btn, EmptyState, IconBtn, Kicker, Modal, Panel, Select, Spinner } from '@/components/marketing/studio-ui';
import type { CampaignBrief, CampaignRecord, CampaignStatus, CreativePack, DesignSummary } from '@/lib/marketing/types';
import { AUDIENCE_MAP, FEATURE_MAP } from '@/lib/marketing/brand';
import { generatePack, newSeed, stripEmphasis } from '@/lib/marketing/copy';
import { findRiskyClaims } from '@/lib/marketing/claims';
import { CAMPAIGN_STATUS, CAROUSEL_PREFIX, formatRange, production } from '@/lib/marketing/production';
import { buildFromTemplate, type TemplateContent } from '@/lib/marketing/templates';
import { api, saveNewDesign, shortName, useAiStatus, useBrandKit } from '@/lib/marketing/client';
import { alertMessage, confirmAction, toastSuccess } from '@/lib/alerts';
import { cn } from '@/lib/utils';

type Tab = 'concepto' | 'titulares' | 'copys' | 'historias' | 'carruseles' | 'reels' | 'extras' | 'piezas';

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <IconBtn
      label="Copiar texto"
      onClick={() => {
        navigator.clipboard.writeText(stripEmphasis(text)).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        });
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </IconBtn>
  );
}

/** Story frame → template + content. Frames are "question", "pain", "headline", "*Feature*\nfact", offer, "CTA.\nWhatsApp …". */
function frameToDesign(frame: string, i: number, total: number): { templateId: string; content: TemplateContent } {
  const [first, ...rest] = frame.split('\n');
  const body = rest.join(' ').trim() || undefined;
  if (i === 0) return { templateId: 'pregunta', content: { headline: frame } };
  if (i === total - 1 && /whatsapp/i.test(frame)) return { templateId: 'demo', content: { headline: first.replace(/\.$/, '') } };
  if (first.startsWith('*') && body) return { templateId: 'dato', content: { headline: first, body, index: String(i).padStart(2, '0') } };
  if (first.startsWith('¿Te suena?') && body) return { templateId: 'editorial', content: { kicker: '¿Te suena?', headline: body } };
  return { templateId: 'pantalla', content: { headline: first, body } };
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const { kit } = useBrandKit();
  const aiEnabled = useAiStatus();
  const [c, setC] = useState<CampaignRecord | null>(null);
  const [tab, setTab] = useState<Tab>('concepto');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newDesign, setNewDesign] = useState<NewDesignDefaults | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    api<CampaignRecord>(`/api/marketing/campaigns/${id}`)
      .then(setC)
      .catch((e) => alertMessage(e.message));
  }, [id]);
  useEffect(() => load(), [load]);

  const update = async (patch: Partial<Pick<CampaignRecord, 'name' | 'status' | 'brief' | 'content'>>) => {
    if (!c) return;
    const saved = await api<CampaignRecord>(`/api/marketing/campaigns/${c.id}`, { method: 'PUT', json: patch });
    setC((prev) => (prev ? { ...prev, ...saved, designs: prev.designs } : prev));
  };

  const regenerate = async (source: 'motor' | 'ia') => {
    if (!c) return;
    if (c.content && !(await confirmAction('Se reemplaza el paquete creativo actual (las piezas ya creadas no se tocan). ¿Seguir?', 'Regenerar'))) return;
    setBusy(source);
    try {
      let pack: CreativePack;
      if (source === 'ia') {
        const r = await api<{ pack: CreativePack }>('/api/marketing/ai', {
          method: 'POST',
          json: { task: 'pack', name: c.name, brief: c.brief, cta: kit.cta, whatsapp: kit.whatsapp },
        });
        pack = r.pack;
      } else {
        pack = generatePack(c.name, c.brief, newSeed(), { cta: kit.cta, whatsapp: kit.whatsapp });
      }
      await update({ content: pack });
      toastSuccess(source === 'ia' ? 'Paquete generado con IA' : 'Nuevas variantes generadas');
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const createMany = async (key: string, items: { name: string; templateId: string; format: 'story' | 'post' | 'portrait' | 'reel-cover'; content: TemplateContent }[]) => {
    if (!c) return;
    setBusy(key);
    try {
      for (const it of items) {
        await saveNewDesign(it.name, buildFromTemplate(it.templateId, it.format, it.content, kit), c.id);
      }
      toastSuccess(items.length === 1 ? 'Pieza creada' : `${items.length} piezas creadas`);
      load();
      setTab('piezas');
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const warnings = useMemo(() => (c?.content ? findRiskyClaims(JSON.stringify(c.content), c.brief.offer) : []), [c]);

  if (!c) {
    return (
      <StudioLayout title="Campaña">
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </StudioLayout>
    );
  }

  const pack = c.content;
  const rows = production(c.brief, c.designs ?? []);
  const st = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.DRAFT;
  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'concepto', label: 'Concepto' },
    { key: 'titulares', label: 'Titulares', count: pack?.headlines.length },
    { key: 'copys', label: 'Copys', count: pack?.copies.length },
    { key: 'historias', label: 'Historias', count: pack?.stories.length },
    { key: 'carruseles', label: 'Carruseles', count: pack?.carousels.length },
    { key: 'reels', label: 'Reels', count: pack?.reels.length },
    { key: 'extras', label: 'CTA y WhatsApp' },
    { key: 'piezas', label: 'Piezas', count: c.designs?.length ?? 0 },
  ];

  return (
    <StudioLayout
      title={c.name}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>{st.label}</span>
          <span className="font-mono text-xs">{formatRange(c.brief)}</span>
          <span>· {AUDIENCE_MAP[c.brief.audience]?.label}</span>
          {pack ? <span>· Paquete: {pack.source === 'ia' ? 'IA' : 'motor de textos'}</span> : null}
        </span>
      }
      actions={
        <>
          <Select value={c.status} onChange={(e) => update({ status: e.target.value as CampaignStatus })} className="h-10 w-36">
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activa</option>
            <option value="FINISHED">Finalizada</option>
          </Select>
          <Btn variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Brief
          </Btn>
          <Btn variant="outline" loading={busy === 'motor'} onClick={() => regenerate('motor')}>
            {busy !== 'motor' && <RefreshCw className="h-4 w-4" />} Otras variantes
          </Btn>
          {aiEnabled && (
            <Btn variant="outline" loading={busy === 'ia'} onClick={() => regenerate('ia')}>
              {busy !== 'ia' && <Sparkles className="h-4 w-4" />} Generar con IA
            </Btn>
          )}
          <Btn variant="primary" onClick={() => setNewDesign({ campaignId: c.id, headline: c.brief.mainMessage || pack?.headlines[0] })}>
            <Plus className="h-4 w-4" /> Nueva pieza
          </Btn>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors',
                  tab === t.key ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {t.count !== undefined ? <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{t.count}</span> : null}
              </button>
            ))}
          </div>

          {warnings.length > 0 && tab !== 'piezas' && (
            <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-warning">
                <TriangleAlert className="h-4 w-4" /> Revisá antes de publicar
              </p>
              <p className="mt-1 text-muted-foreground">Estas frases pueden ser datos no verificados (precios, cifras, integraciones o promesas):</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {warnings.map((w) => (
                  <span key={w.phrase} className="rounded-md bg-background/60 px-2 py-1 text-xs">
                    “{w.phrase}” <span className="text-muted-foreground">· {w.reason}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {!pack && tab !== 'piezas' ? (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Sin paquete creativo"
              text="Generá concepto, titulares, copys, historias, carruseles y guiones a partir del brief."
              action={
                <Btn variant="primary" onClick={() => regenerate('motor')}>
                  Generar paquete
                </Btn>
              }
            />
          ) : null}

          {pack && tab === 'concepto' && (
            <div className="space-y-5">
              <Panel>
                <div className="p-6">
                  <Kicker>Concepto creativo</Kicker>
                  <h2 className="mt-2 font-heading text-3xl font-extrabold leading-tight tracking-tight">{stripEmphasis(pack.concept.title)}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{pack.concept.summary}</p>
                </div>
              </Panel>
              <div className="grid gap-4 md:grid-cols-3">
                {pack.angles.map((a, i) => (
                  <Panel key={a.key + i}>
                    <div className="p-5">
                      <p className="font-mono text-[11px] text-primary">Enfoque {String(i + 1).padStart(2, '0')}</p>
                      <h3 className="mt-1 font-heading text-base font-bold">{a.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.idea}</p>
                    </div>
                  </Panel>
                ))}
              </div>
              <Panel title="Ideas visuales">
                <ul className="divide-y divide-border">
                  {pack.visualIdeas.map((v, i) => (
                    <li key={i} className="px-5 py-3 text-sm text-muted-foreground">
                      {v}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}

          {pack && tab === 'titulares' && (
            <Panel>
              <ul className="divide-y divide-border">
                {pack.headlines.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="w-6 font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <p className="flex-1 font-heading text-[15px] font-semibold">
                      {h.split('*').map((part, j) => (j % 2 ? <span key={j} className="text-primary">{part}</span> : part))}
                    </p>
                    <CopyBtn text={h} />
                    <Btn size="sm" variant="outline" onClick={() => setNewDesign({ campaignId: c.id, headline: h })}>
                      Crear pieza
                    </Btn>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {pack && tab === 'copys' && (
            <div className="grid gap-4 md:grid-cols-2">
              {pack.copies.map((cp, i) => (
                <Panel key={i} title={cp.angle} action={<CopyBtn text={cp.text} />}>
                  <p className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-muted-foreground">{stripEmphasis(cp.text)}</p>
                </Panel>
              ))}
            </div>
          )}

          {pack && tab === 'historias' && (
            <div className="space-y-4">
              {pack.stories.map((s, i) => (
                <Panel
                  key={i}
                  title={`${s.title} · ${s.frames.length} pantallas`}
                  action={
                    <Btn
                      size="sm"
                      variant="primary"
                      loading={busy === `story${i}`}
                      onClick={() =>
                        createMany(
                          `story${i}`,
                          s.frames.map((f, j) => {
                            const m = frameToDesign(f, j, s.frames.length);
                            return { name: `Historia · ${shortName(s.title, 28)} · ${j + 1}/${s.frames.length}`, format: 'story' as const, ...m };
                          }),
                        )
                      }
                    >
                      Crear secuencia
                    </Btn>
                  }
                >
                  <ol className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {s.frames.map((f, j) => (
                      <li key={j} className="rounded-lg border border-border bg-background/40 p-3">
                        <p className="mb-1.5 font-mono text-[10px] text-muted-foreground">
                          {j + 1}/{s.frames.length} · {frameToDesign(f, j, s.frames.length).templateId}
                        </p>
                        <p className="whitespace-pre-line text-sm">{stripEmphasis(f)}</p>
                      </li>
                    ))}
                  </ol>
                </Panel>
              ))}
            </div>
          )}

          {pack && tab === 'carruseles' && (
            <div className="space-y-4">
              {pack.carousels.map((car, i) => (
                <Panel
                  key={i}
                  title={`${car.title} · ${car.slides.length} láminas`}
                  action={
                    <Btn
                      size="sm"
                      variant="primary"
                      loading={busy === `car${i}`}
                      onClick={() =>
                        createMany(
                          `car${i}`,
                          car.slides.map((sl, j) => ({
                            name: `${CAROUSEL_PREFIX}${shortName(car.title, 28)} · ${String(j + 1).padStart(2, '0')}`,
                            format: 'portrait' as const,
                            templateId: 'carrusel',
                            content: {
                              headline: sl.title,
                              body: sl.body || undefined,
                              index: `${String(j + 1).padStart(2, '0')} / ${String(car.slides.length).padStart(2, '0')}`,
                              kicker: j === car.slides.length - 1 ? kit.cta : 'Deslizá →',
                            },
                          })),
                        )
                      }
                    >
                      Crear carrusel
                    </Btn>
                  }
                >
                  <ol className="flex gap-3 overflow-x-auto p-5">
                    {car.slides.map((sl, j) => (
                      <li key={j} className="w-48 shrink-0 rounded-lg border border-border bg-background/40 p-3">
                        <p className="font-mono text-[10px] text-muted-foreground">{String(j + 1).padStart(2, '0')}</p>
                        <p className="mt-1 text-sm font-semibold">{stripEmphasis(sl.title)}</p>
                        {sl.body ? <p className="mt-1 text-xs text-muted-foreground">{sl.body}</p> : null}
                      </li>
                    ))}
                  </ol>
                </Panel>
              ))}
            </div>
          )}

          {pack && tab === 'reels' && (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clapperboard className="h-3.5 w-3.5" /> La edición de video llega con Reel Studio. Por ahora, el guion y la portada.
              </p>
              {pack.reels.map((r, i) => (
                <Panel
                  key={i}
                  title={`${r.title}`}
                  action={
                    <div className="flex gap-1">
                      <CopyBtn text={r.scenes.map((s) => `[${s.time}] ${s.visual}\nTexto: ${s.onScreen}\nVoz: ${s.voiceover}`).join('\n\n')} />
                      <Btn
                        size="sm"
                        variant="primary"
                        loading={busy === `reel${i}`}
                        onClick={() =>
                          createMany(`reel${i}`, [
                            { name: `Portada reel · ${shortName(r.title, 32)}`, format: 'reel-cover', templateId: 'pregunta', content: { headline: r.hook, kicker: 'Reel' } },
                          ])
                        }
                      >
                        Crear portada
                      </Btn>
                    </div>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-5 py-2 font-medium">Tiempo</th>
                          <th className="px-3 py-2 font-medium">Imagen</th>
                          <th className="px-3 py-2 font-medium">Texto en pantalla</th>
                          <th className="px-5 py-2 font-medium">Voz en off</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {r.scenes.map((s, j) => (
                          <tr key={j} className="align-top">
                            <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-primary">{s.time}</td>
                            <td className="px-3 py-3 text-muted-foreground">{s.visual}</td>
                            <td className="px-3 py-3 font-medium">{s.onScreen}</td>
                            <td className="px-5 py-3 text-muted-foreground">{s.voiceover}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ))}
            </div>
          )}

          {pack && tab === 'extras' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="CTA">
                <ul className="divide-y divide-border">
                  {pack.ctas.map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                      {t}
                      <CopyBtn text={t} />
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Mensajes de WhatsApp">
                <ul className="divide-y divide-border">
                  {pack.whatsapp.map((t, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 px-5 py-3 text-sm text-muted-foreground">
                      <span>{t}</span>
                      <CopyBtn text={t} />
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}

          {tab === 'piezas' &&
            ((c.designs?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<LayoutGrid className="h-5 w-5" />}
                title="Todavía no hay piezas"
                text="Creá piezas desde los titulares, las historias o los carruseles, o empezá una en blanco."
                action={
                  <Btn variant="primary" onClick={() => setNewDesign({ campaignId: c.id })}>
                    <Plus className="h-4 w-4" /> Nueva pieza
                  </Btn>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {c.designs!.map((d) => (
                  <DesignCard key={d.id} d={{ ...(d as DesignSummary), campaign: null }} onChanged={load} />
                ))}
              </div>
            ))}
        </div>

        <aside className="space-y-4">
          <Panel title="Producción">
            <div className="p-5">
              <ProductionBars rows={rows} />
              <p className="mt-3 text-[11px] text-muted-foreground">Barra verde: piezas creadas. Lima: aprobadas.</p>
            </div>
          </Panel>
          <Panel title="Brief" action={<IconBtn label="Editar brief" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></IconBtn>}>
            <dl className="space-y-3 p-5 text-sm">
              {[
                ['Objetivo', c.brief.objective],
                ['Público', `${AUDIENCE_MAP[c.brief.audience]?.label}${c.brief.audienceNotes ? ` · ${c.brief.audienceNotes}` : ''}`],
                ['Mensaje', stripEmphasis(c.brief.mainMessage)],
                ['Propuesta', c.brief.offer || 'Sin propuesta comercial (no se mencionan condiciones)'],
                ['Canales', c.brief.channels.join(', ')],
                ['Foco', c.brief.features.map((f) => FEATURE_MAP[f]?.name).filter(Boolean).join(', ')],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Btn
            variant="danger"
            size="sm"
            className="w-full"
            onClick={async () => {
              if (!(await confirmAction('¿Eliminar la campaña? Las piezas quedan guardadas sin campaña.', 'Eliminar'))) return;
              await api(`/api/marketing/campaigns/${c.id}`, { method: 'DELETE' });
              router.push('/superadmin/marketing/campaigns');
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar campaña
          </Btn>
        </aside>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar brief" wide>
        <CampaignForm
          initialName={c.name}
          initialBrief={c.brief as CampaignBrief}
          submitLabel="Guardar"
          onCancel={() => setEditing(false)}
          onSubmit={async (name, brief) => {
            try {
              await update({ name, brief });
              setEditing(false);
              toastSuccess('Brief actualizado. Usá "Otras variantes" para regenerar el paquete.');
            } catch (e) {
              alertMessage((e as Error).message);
            }
          }}
        />
      </Modal>

      <NewDesignModal open={Boolean(newDesign)} onClose={() => setNewDesign(null)} kit={kit} defaults={newDesign ?? undefined} />
    </StudioLayout>
  );
}
