import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Check, Copy, PenLine, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import NewDesignModal, { type NewDesignDefaults } from '@/components/marketing/new-design-modal';
import { Btn, EmptyState, Field, IconBtn, Panel, Select, TextArea, TextInput } from '@/components/marketing/studio-ui';
import type { AudienceKey } from '@/lib/marketing/types';
import { AUDIENCES, FEATURES } from '@/lib/marketing/brand';
import { ANGLES, COPY_KINDS, generateCopy, newSeed, stripEmphasis, type CopyItem, type CopyKind } from '@/lib/marketing/copy';
import { findRiskyClaims, type ClaimWarning } from '@/lib/marketing/claims';
import { api, useAiStatus, useBrandKit } from '@/lib/marketing/client';
import { alertMessage } from '@/lib/alerts';
import { cn } from '@/lib/utils';

function CopyText({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <IconBtn
      label="Copiar"
      onClick={() =>
        navigator.clipboard.writeText(stripEmphasis(text)).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        })
      }
    >
      {ok ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </IconBtn>
  );
}

export default function CopywriterPage() {
  const router = useRouter();
  const { kit } = useBrandKit();
  const aiEnabled = useAiStatus();
  const [kind, setKind] = useState<CopyKind>('titulares');
  const [audience, setAudience] = useState<AudienceKey>('general');
  const [angle, setAngle] = useState('mix');
  const [features, setFeatures] = useState<string[]>([]);
  const [offer, setOffer] = useState('');
  const [instructions, setInstructions] = useState('');
  const [items, setItems] = useState<CopyItem[]>([]);
  const [source, setSource] = useState<'motor' | 'ia'>('motor');
  const [warnings, setWarnings] = useState<ClaimWarning[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [design, setDesign] = useState<NewDesignDefaults | null>(null);

  useEffect(() => {
    const k = router.query.kind;
    if (typeof k === 'string' && COPY_KINDS.some((x) => x.key === k)) setKind(k as CopyKind);
  }, [router.query.kind]);

  const runMotor = () => {
    const out = generateCopy({ kind, audience, angle, features, seed: newSeed(), count: 6, offer, cta: kit.cta, whatsapp: kit.whatsapp });
    setItems(out);
    setSource('motor');
    setWarnings([]);
  };

  // First batch on load and whenever the request changes.
  useEffect(runMotor, [kind, audience, angle, features, kit.cta, kit.whatsapp]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAi = async () => {
    setLoadingAi(true);
    try {
      const r = await api<{ items: CopyItem[]; warnings: ClaimWarning[] }>('/api/marketing/ai', {
        method: 'POST',
        json: { task: 'copy', kind, audience, angle, features, offer, count: 6, instructions, cta: kit.cta, whatsapp: kit.whatsapp },
      });
      setItems(r.items);
      setSource('ia');
      setWarnings(r.warnings);
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setLoadingAi(false);
    }
  };

  const itemWarnings = useMemo(() => items.map((it) => (source === 'ia' ? findRiskyClaims(it.text, offer) : [])), [items, source, offer]);
  const kindInfo = COPY_KINDS.find((k) => k.key === kind)!;

  return (
    <StudioLayout title="Textos" subtitle="Titulares, copys, guiones y mensajes escritos solo con información verificada de WALTI. Tono cercano, claro y argentino.">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel>
          <div className="space-y-4 p-5">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Qué necesitás</p>
              <div className="grid grid-cols-2 gap-1.5">
                {COPY_KINDS.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => setKind(k.key)}
                    className={cn('rounded-lg border px-2.5 py-2 text-left text-xs transition-colors', kind === k.key ? 'border-primary bg-primary/10 font-semibold' : 'border-border text-muted-foreground hover:text-foreground')}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Público">
              <Select value={audience} onChange={(e) => setAudience(e.target.value as AudienceKey)}>
                {AUDIENCES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Enfoque creativo" hint={ANGLES.find((a) => a.key === angle)?.idea ?? 'Mezcla de enfoques para no repetir el mismo mensaje.'}>
              <Select value={angle} onChange={(e) => setAngle(e.target.value)}>
                <option value="mix">Mezclar enfoques</option>
                {ANGLES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Funcionalidades (opcional)</p>
              <div className="flex flex-wrap gap-1.5">
                {FEATURES.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFeatures((fs) => (fs.includes(f.key) ? fs.filter((x) => x !== f.key) : [...fs, f.key]))}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px]',
                      features.includes(f.key) ? 'border-primary bg-primary/15' : 'border-border text-muted-foreground',
                      f.needsConfirmation && 'border-dashed',
                    )}
                    title={f.needsConfirmation ? 'A confirmar: no está en el sistema actual' : f.fact}
                  >
                    {f.name}
                    {f.needsConfirmation ? ' ·?' : ''}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Propuesta comercial" hint="Solo si está confirmada. Se usa tal cual.">
              <TextInput value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Vacío = sin condiciones" />
            </Field>
            {aiEnabled && (
              <Field label="Indicaciones para la IA (opcional)">
                <TextArea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="Ej.: más corto, para rubro ferretería" />
              </Field>
            )}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Btn variant="primary" onClick={runMotor}>
                <RefreshCw className="h-4 w-4" /> Otras variantes
              </Btn>
              {aiEnabled ? (
                <Btn variant="outline" loading={loadingAi} onClick={runAi}>
                  {!loadingAi && <Sparkles className="h-4 w-4" />} Escribir con IA
                </Btn>
              ) : (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  IA opcional: se activa agregando ANTHROPIC_API_KEY en el servidor. El motor de textos funciona sin ella.
                </p>
              )}
            </div>
          </div>
        </Panel>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm">
              <span className="font-semibold">{kindInfo.label}</span>
              <span className="text-muted-foreground"> · {kindInfo.hint}</span>
            </p>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px]', source === 'ia' ? 'bg-secondary/15 text-secondary' : 'bg-accent text-muted-foreground')}>
              {source === 'ia' ? 'Escrito con IA' : 'Motor de textos'}
            </span>
          </div>
          {warnings.length > 0 && (
            <p className="mb-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              La IA escribió frases que pueden no estar verificadas. Están marcadas en cada texto.
            </p>
          )}
          {items.length === 0 ? (
            <EmptyState icon={<PenLine className="h-5 w-5" />} title="Sin textos" text="Elegí qué necesitás y generá variantes." />
          ) : (
            <div className={cn('grid gap-3', kind === 'titulares' || kind === 'cta' ? 'md:grid-cols-2' : '')}>
              {items.map((it, i) => (
                <Panel key={i}>
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{it.title || `Variante ${i + 1}`}</span>
                      <div className="flex items-center gap-1">
                        <CopyText text={it.text} />
                        {it.headline && kind !== 'whatsapp' && kind !== 'cta' && (
                          <Btn size="sm" variant="outline" onClick={() => setDesign({ headline: it.headline, body: kind === 'descripcion' ? it.body : undefined })}>
                            Crear pieza
                          </Btn>
                        )}
                      </div>
                    </div>
                    <p className={cn('whitespace-pre-line leading-relaxed', kind === 'titulares' ? 'font-heading text-lg font-bold' : 'text-sm text-muted-foreground')}>
                      {kind === 'titulares' ? it.text.split('*').map((p, j) => (j % 2 ? <span key={j} className="text-primary">{p}</span> : p)) : stripEmphasis(it.text)}
                    </p>
                    {itemWarnings[i]?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {itemWarnings[i].map((w) => (
                          <span key={w.phrase} className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] text-warning">
                            {w.reason}: “{w.phrase}”
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
      <NewDesignModal open={Boolean(design)} onClose={() => setDesign(null)} kit={kit} defaults={design ?? undefined} />
    </StudioLayout>
  );
}
