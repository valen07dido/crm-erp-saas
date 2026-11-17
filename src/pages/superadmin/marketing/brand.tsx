import React, { useEffect, useState } from 'react';
import { FolderOpen, Plus, Save, Trash2 } from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import { CATEGORY_LABELS, UploadButton, useAssets } from '@/components/marketing/asset-picker';
import { Btn, EmptyState, Field, IconBtn, Panel, Segmented, Spinner, TextInput } from '@/components/marketing/studio-ui';
import type { AssetCategory, BrandKit } from '@/lib/marketing/types';
import { BUILTIN_LOGOS, FEATURES, formatWhatsapp, whatsappLink } from '@/lib/marketing/brand';
import { FONT_OPTIONS } from '@/lib/marketing/fonts';
import { api, useBrandKit } from '@/lib/marketing/client';
import { alertMessage, confirmAction, toastSuccess } from '@/lib/alerts';
import { cn } from '@/lib/utils';

type LibTab = 'all' | AssetCategory;

export default function BrandPage() {
  const { kit, loaded, save } = useBrandKit();
  const [draft, setDraft] = useState<BrandKit>(kit);
  const [saving, setSaving] = useState(false);
  const { assets, setAssets, loading } = useAssets();
  const [tab, setTab] = useState<LibTab>('screenshot');

  useEffect(() => setDraft(kit), [kit]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(kit);

  const onSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      toastSuccess('Brand kit guardado');
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!(await confirmAction(`¿Quitar "${name}" de la biblioteca? Las piezas que ya lo usan no cambian.`, 'Quitar'))) return;
    try {
      await api(`/api/marketing/assets/${id}`, { method: 'DELETE' });
      setAssets((a) => a.filter((x) => x.id !== id));
    } catch (e) {
      alertMessage((e as Error).message);
    }
  };

  const shown = assets.filter((a) => tab === 'all' || a.category === tab);
  const uploadCategory: AssetCategory = tab === 'all' ? 'other' : tab;
  const counts = assets.reduce<Record<string, number>>((m, a) => ((m[a.category] = (m[a.category] ?? 0) + 1), m), {});

  return (
    <StudioLayout
      title="Marca y recursos"
      subtitle="La identidad que usan todas las piezas: colores, tipografías, logos originales, contacto y la biblioteca de capturas, fotos y videos."
      actions={
        <Btn variant="primary" onClick={onSave} loading={saving} disabled={!dirty || !loaded}>
          {!saving && <Save className="h-4 w-4" />} Guardar marca
        </Btn>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Colores">
          <div className="space-y-2 p-5">
            {draft.colors.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/15" style={{ background: c.hex }}>
                  <input
                    type="color"
                    value={c.hex}
                    onChange={(e) => setDraft((d) => ({ ...d, colors: d.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)) }))}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <TextInput
                  value={c.name}
                  onChange={(e) => setDraft((d) => ({ ...d, colors: d.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
                  className="h-9 w-36"
                />
                <span className="w-20 font-mono text-xs text-muted-foreground">{c.hex}</span>
                <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">{c.role}</span>
                {i >= 5 && (
                  <IconBtn label="Quitar color" onClick={() => setDraft((d) => ({ ...d, colors: d.colors.filter((_, j) => j !== i) }))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                )}
              </div>
            ))}
            {draft.colors.length < 12 && (
              <Btn variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, colors: [...d.colors, { name: 'Nuevo', hex: '#5A6268', role: 'Complementario' }] }))}>
                <Plus className="h-3.5 w-3.5" /> Agregar color
              </Btn>
            )}
            <p className="pt-2 text-[11px] text-muted-foreground">El verde lima es un color de relleno: sobre fondos claros no se usa como color de texto porque no se lee bien.</p>
          </div>
        </Panel>

        <Panel title="Contacto y llamado a la acción">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="WhatsApp comercial" hint={`Se muestra como ${formatWhatsapp(draft.whatsapp)}`}>
              <TextInput value={draft.whatsapp} onChange={(e) => setDraft((d) => ({ ...d, whatsapp: e.target.value }))} />
            </Field>
            <Field label="CTA principal">
              <TextInput value={draft.cta} onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))} />
            </Field>
            <Field label="Instagram (opcional)" hint="Solo aparece si está cargado.">
              <TextInput value={draft.instagram} onChange={(e) => setDraft((d) => ({ ...d, instagram: e.target.value }))} placeholder="@usuario" />
            </Field>
            <Field label="Sitio web (opcional)">
              <TextInput value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} placeholder="Sin cargar" />
            </Field>
            <Field label="Bajada de marca" className="sm:col-span-2">
              <TextInput value={draft.tagline} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} />
            </Field>
            <a href={whatsappLink(draft.whatsapp, 'Hola, quiero solicitar una demostración personalizada de WALTI.')} target="_blank" rel="noreferrer" className="text-xs text-primary underline sm:col-span-2">
              Probar el link de WhatsApp con mensaje precargado
            </a>
          </div>
        </Panel>

        <Panel title="Tipografías">
          <ul className="divide-y divide-border">
            {FONT_OPTIONS.map((f) => (
              <li key={f.key} className="flex items-baseline justify-between gap-4 px-5 py-4">
                <span className="truncate text-2xl" style={{ fontFamily: f.family, fontWeight: f.weights.includes(700) ? 700 : 400 }}>
                  {f.label}
                </span>
                <span className="shrink-0 text-right text-[11px] text-muted-foreground">{f.role}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Logos originales">
          <div className="grid grid-cols-3 gap-3 p-5">
            {[...BUILTIN_LOGOS, ...assets.filter((a) => a.category === 'logo')].map((l) => (
              <div key={l.id} className="overflow-hidden rounded-lg border border-border">
                <div className="flex aspect-[4/3] items-center justify-center bg-ivory p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.url} alt={l.name} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-medium">{l.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {l.width && l.height ? `${l.width}×${l.height}` : ''} {l.builtIn ? '· original' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="px-5 pb-5 text-[11px] leading-relaxed text-muted-foreground">
            Los logos se usan siempre con su proporción y colores originales. El logo con mascota mide 392 px de ancho: para piezas grandes conviene subir una versión en alta resolución.
          </p>
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Biblioteca de recursos"
        action={<UploadButton category={uploadCategory} accept={tab === 'video' ? 'video/*' : tab === 'all' ? 'image/*,video/*' : 'image/*'} onUploaded={(a) => setAssets((p) => [a, ...p])} label={`Subir${tab === 'all' ? '' : ` a ${CATEGORY_LABELS[tab]}`}`} variant="primary" />}
      >
        <div className="p-5">
          <Segmented
            className="mb-5 flex-wrap"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: `Todo (${assets.length})` },
              ...(['screenshot', 'photo', 'video', 'logo', 'icon', 'template', 'other'] as AssetCategory[]).map((k) => ({ value: k, label: `${CATEGORY_LABELS[k]} (${counts[k] ?? 0})` })),
            ]}
          />
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="h-5 w-5" />}
              title={tab === 'screenshot' ? 'Subí capturas reales de WALTI' : 'Sin recursos en esta categoría'}
              text={
                tab === 'screenshot'
                  ? 'Las piezas usan capturas reales del sistema, nunca pantallas simuladas. Sugerencia: Dashboard, Productos, Punto de Venta, Caja y la página pública.'
                  : 'Subí archivos para tenerlos a mano en el editor.'
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {shown.map((a) => (
                <div key={a.id} className="group overflow-hidden rounded-lg border border-border">
                  <div className={cn('relative flex aspect-[4/3] items-center justify-center overflow-hidden', a.category === 'logo' ? 'bg-ivory p-3' : 'bg-black/30')}>
                    {a.category === 'video' ? (
                      <video src={a.url} className="h-full w-full object-cover" muted controls preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.name} className={a.category === 'logo' ? 'max-h-full max-w-full object-contain' : 'h-full w-full object-cover object-top'} />
                    )}
                    <IconBtn label="Quitar" onClick={() => remove(a.id, a.name)} className="absolute right-1.5 top-1.5 bg-card/90 opacity-0 group-hover:opacity-100 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-medium">{a.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {CATEGORY_LABELS[a.category]} {a.width && a.height ? `· ${a.width}×${a.height}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel className="mt-6" title="Información verificada que usan los textos">
        <ul className="grid gap-x-6 gap-y-2 p-5 text-sm md:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.key} className="flex gap-2">
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', f.needsConfirmation ? 'bg-warning' : 'bg-primary')} />
              <span>
                <span className="font-medium">{f.name}:</span> <span className="text-muted-foreground">{f.fact}</span>
                {f.needsConfirmation ? <span className="block text-[11px] text-warning">A confirmar: no lo encontré en el sistema actual (los productos no tienen campo de costo).</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </StudioLayout>
  );
}
