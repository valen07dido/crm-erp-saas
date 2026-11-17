import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Circle,
  Copy,
  Download,
  Grid3x3,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Minus,
  Plus,
  Redo2,
  Square,
  TriangleAlert,
  Type,
  Undo2,
} from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import Stage from '@/components/marketing/editor/stage';
import { LayersPanel, PropertiesPanel } from '@/components/marketing/editor/properties';
import { AssetPicker } from '@/components/marketing/asset-picker';
import { Btn, IconBtn, Segmented, Select, Spinner } from '@/components/marketing/studio-ui';
import type { AssetRecord, Background, CampaignRecord, DesignDoc, DesignRecord, DesignStatus, FormatId, ImageLayer, Layer, TextLayer } from '@/lib/marketing/types';
import { FORMATS } from '@/lib/marketing/formats';
import { BRAND } from '@/lib/marketing/brand';
import { buildFromTemplate, cloneDoc, imageLayer, shapeLayer, textLayer, uid, type TemplateContent } from '@/lib/marketing/templates';
import { loadImage, type RenderResult } from '@/lib/marketing/render';
import { downloadBlob, exportDesign, makeThumbnail, slugify, type ImageFormat } from '@/lib/marketing/export';
import { api, saveNewDesign, useBrandKit } from '@/lib/marketing/client';
import { alertMessage, confirmAction, toastSuccess } from '@/lib/alerts';
import { cn } from '@/lib/utils';

// ─── Undo/redo history ──────────────────────────────────────────────────────

function useDocHistory() {
  const [doc, setDocState] = useState<DesignDoc | null>(null);
  const [version, setVersion] = useState(0);
  const docRef = useRef<DesignDoc | null>(null);
  const past = useRef<DesignDoc[]>([]);
  const future = useRef<DesignDoc[]>([]);
  const pending = useRef<DesignDoc | null>(null);
  const merge = useRef<{ key: string; t: number } | null>(null);

  const apply = (next: DesignDoc) => {
    docRef.current = next;
    setDocState(next);
    setVersion((v) => v + 1);
  };

  const reset = useCallback((d: DesignDoc) => {
    past.current = [];
    future.current = [];
    pending.current = null;
    docRef.current = d;
    setDocState(d);
  }, []);

  /** `transient`: live drag updates (one undo step on endTransient). `mergeKey`: typing/sliders merge into one step. */
  const set = useCallback((fn: (d: DesignDoc) => DesignDoc, opts?: { transient?: boolean; mergeKey?: string }) => {
    const cur = docRef.current;
    if (!cur) return;
    const next = fn(cur);
    if (opts?.transient) {
      if (!pending.current) pending.current = cur;
      apply(next);
      return;
    }
    const now = Date.now();
    const m = merge.current;
    const merging = opts?.mergeKey && m && m.key === opts.mergeKey && now - m.t < 900;
    if (!merging) past.current = [...past.current.slice(-79), pending.current ?? cur];
    pending.current = null;
    merge.current = opts?.mergeKey ? { key: opts.mergeKey, t: now } : null;
    future.current = [];
    apply(next);
  }, []);

  const endTransient = useCallback(() => {
    if (!pending.current) return;
    past.current = [...past.current.slice(-79), pending.current];
    pending.current = null;
    future.current = [];
    merge.current = null;
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !docRef.current) return;
    future.current = [docRef.current, ...future.current];
    merge.current = null;
    apply(prev);
  }, []);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next || !docRef.current) return;
    past.current = [...past.current, docRef.current];
    future.current = rest;
    merge.current = null;
    apply(next);
  }, []);

  return { doc, version, docRef, reset, set, endTransient, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type PickerMode = { mode: 'add'; tab: 'screenshot' | 'photo' | 'logo' } | { mode: 'replace'; layerId: string } | { mode: 'background' };

function contentFromDoc(doc: DesignDoc): { content: TemplateContent; screenshot?: string } {
  const byName = (n: string) => doc.layers.find((l): l is TextLayer => l.type === 'text' && l.name === n)?.text;
  const shot = doc.layers.find((l): l is ImageLayer => l.type === 'image' && l.role === 'screenshot' && Boolean(l.src));
  return {
    content: {
      headline: byName('Titular') || '',
      body: byName('Texto') || byName('Condiciones'),
      kicker: byName('Etiqueta'),
      cta: byName('CTA'),
      highlight: byName('Beneficio'),
      index: byName('Número'),
    },
    screenshot: shot?.src,
  };
}

function outsideSafe(doc: DesignDoc, heights: Record<string, number>): Layer[] {
  const s = FORMATS[doc.format].safe;
  const minX = s.left - 2;
  const minY = s.top - 2;
  const maxX = doc.width - s.right + 2;
  const maxY = doc.height - s.bottom + 2;
  return doc.layers.filter((l) => {
    if (l.hidden) return false;
    const important = l.type === 'text' || (l.type === 'image' && l.role === 'logo');
    if (!important) return false;
    const h = l.type === 'text' ? heights[l.id] ?? l.h : l.h;
    return l.x < minX || l.y < minY || l.x + l.w > maxX || l.y + h > maxY;
  });
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const { kit } = useBrandKit();
  const h = useDocHistory();
  const { doc, set, undo, redo, endTransient, reset } = h;

  const [meta, setMeta] = useState<{ name: string; status: DesignStatus; campaignId: string | null } | null>(null);
  const [campaigns, setCampaigns] = useState<Pick<CampaignRecord, 'id' | 'name'>[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [scale, setScale] = useState(1);
  const [showSafe, setShowSafe] = useState(true);
  const [leftTab, setLeftTab] = useState<'add' | 'layers'>('add');
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [render, setRender] = useState<RenderResult>({ textHeights: {}, placeholders: [] });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const savedVersion = useRef(0);
  const [metaTick, setMetaTick] = useState(0);
  // Every doc or meta change bumps this; autosave compares it with what was last persisted.
  const totalVersion = h.version + metaTick;
  const versionRef = useRef(totalVersion);
  versionRef.current = totalVersion;

  // Load
  useEffect(() => {
    if (!id) return;
    let alive = true;
    api<DesignRecord>(`/api/marketing/designs/${id}`)
      .then((d) => {
        if (!alive) return;
        reset(d.doc);
        setMeta({ name: d.name, status: d.status, campaignId: d.campaignId });
        setSelectedId(null);
        setSaveState('saved');
        savedVersion.current = versionRef.current;
      })
      .catch(() => alive && setNotFound(true));
    api<CampaignRecord[]>('/api/marketing/campaigns')
      .then((c) => alive && setCampaigns(c.map(({ id: cid, name }) => ({ id: cid, name }))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, reset]);

  const selected = useMemo(() => doc?.layers.find((l) => l.id === selectedId) ?? null, [doc, selectedId]);

  useEffect(() => {
    setNaturalWidth(null);
    if (selected?.type === 'image' && selected.src) {
      let alive = true;
      loadImage(selected.src).then((img) => alive && setNaturalWidth(img?.naturalWidth ?? null));
      return () => {
        alive = false;
      };
    }
  }, [selected?.type, selected && selected.type === 'image' ? selected.src : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mutations ───────────────────────────────────────────────────────────

  const updateLayer = useCallback(
    (lid: string, patch: Partial<Layer>, opts?: { transient?: boolean; mergeKey?: string }) =>
      set((d) => ({ ...d, layers: d.layers.map((l) => (l.id === lid ? ({ ...l, ...patch } as Layer) : l)) }), opts),
    [set],
  );
  const onLayerFromPanel = useCallback((lid: string, patch: Partial<Layer>) => updateLayer(lid, patch, { mergeKey: `${lid}:${Object.keys(patch).join(',')}` }), [updateLayer]);
  const onLayerDrag = useCallback((lid: string, patch: Partial<Layer>) => updateLayer(lid, patch, { transient: true }), [updateLayer]);
  const onBackground = useCallback(
    (patch: Partial<Background>) => set((d) => ({ ...d, background: { ...d.background, ...patch } }), { mergeKey: `bg:${Object.keys(patch).join(',')}` }),
    [set],
  );

  const addLayer = useCallback(
    (l: Layer) => {
      set((d) => ({ ...d, layers: [...d.layers, l] }));
      setSelectedId(l.id);
      setLeftTab('layers');
    },
    [set],
  );

  const deleteLayer = useCallback(
    (lid: string) => {
      set((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== lid) }));
      setSelectedId((s) => (s === lid ? null : s));
    },
    [set],
  );

  const duplicateLayer = useCallback(
    (lid: string) => {
      const src = h.docRef.current?.layers.find((l) => l.id === lid);
      if (!src) return;
      const copy = { ...JSON.parse(JSON.stringify(src)), id: uid(), name: `${src.name} copia`, x: src.x + 30, y: src.y + 30 } as Layer;
      set((d) => {
        const idx = d.layers.findIndex((l) => l.id === lid);
        const layers = d.layers.slice();
        layers.splice(idx + 1, 0, copy);
        return { ...d, layers };
      });
      setSelectedId(copy.id);
    },
    [set, h.docRef],
  );

  const moveLayer = useCallback(
    (lid: string, dir: 1 | -1) =>
      set((d) => {
        const i = d.layers.findIndex((l) => l.id === lid);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.layers.length) return d;
        const layers = d.layers.slice();
        [layers[i], layers[j]] = [layers[j], layers[i]];
        return { ...d, layers };
      }),
    [set],
  );

  const toggleLayer = useCallback(
    (lid: string, key: 'hidden' | 'locked') => {
      const l = h.docRef.current?.layers.find((x) => x.id === lid);
      if (l) updateLayer(lid, { [key]: !l[key] });
    },
    [updateLayer, h.docRef],
  );

  // ─── Add tools ───────────────────────────────────────────────────────────

  const fmt = doc ? FORMATS[doc.format] : null;
  const addText = (preset: 'titular' | 'texto' | 'etiqueta' | 'cta') => {
    if (!doc || !fmt) return;
    const cw = doc.width - fmt.safe.left - fmt.safe.right;
    const dark = ['#20252B', '#1B2226', '#3D9488'].includes(doc.background.color.toUpperCase()) || doc.background.color.toUpperCase().startsWith('#1');
    const ink = dark ? BRAND.ivory : BRAND.graphite;
    const base = { x: fmt.safe.left, y: Math.round(doc.height * 0.42), w: cw, color: ink, accentColor: dark ? BRAND.lime : BRAND.petroleum };
    const layer =
      preset === 'titular'
        ? textLayer({ ...base, name: 'Titular', text: 'Tu titular *acá*', font: 'manrope', weight: 800, size: 96, lineHeight: 1.03, letterSpacing: -0.03 })
        : preset === 'texto'
          ? textLayer({ ...base, name: 'Texto', text: 'Un texto breve que explique la idea.', size: 40, lineHeight: 1.38 })
          : preset === 'etiqueta'
            ? textLayer({ ...base, name: 'Etiqueta', text: 'Etiqueta', font: 'plexmono', weight: 500, size: 26, letterSpacing: 0.12, uppercase: true, color: dark ? BRAND.lime : BRAND.petroleum })
            : textLayer({
                ...base,
                x: fmt.safe.left + 34,
                name: 'CTA',
                text: kit.cta,
                font: 'manrope',
                weight: 700,
                size: 36,
                lineHeight: 1.2,
                color: dark ? BRAND.graphite : BRAND.lime,
                highlight: { color: dark ? BRAND.lime : BRAND.graphite, padX: 34, padY: 22, radius: 72 },
              });
    addLayer(layer);
  };

  const addShape = (shape: 'rect' | 'ellipse' | 'line') => {
    if (!doc) return;
    const size = Math.round(doc.width * 0.3);
    addLayer(
      shapeLayer({
        name: shape === 'ellipse' ? 'Círculo' : shape === 'line' ? 'Línea' : 'Rectángulo',
        shape,
        x: Math.round(doc.width / 2 - size / 2),
        y: Math.round(doc.height / 2 - (shape === 'line' ? 4 : size / 2)),
        w: size,
        h: shape === 'line' ? 8 : size,
        radius: shape === 'rect' ? 24 : 0,
      }),
    );
  };

  const onPicked = (a: AssetRecord) => {
    if (!doc || !fmt || !picker) return;
    const aspect = a.width && a.height ? a.width / a.height : undefined;
    if (picker.mode === 'background') {
      onBackground({ imageUrl: a.url, imageOpacity: doc.background.imageOpacity ?? 1 });
      return;
    }
    if (picker.mode === 'replace') {
      const l = doc.layers.find((x) => x.id === picker.layerId);
      if (l?.type !== 'image') return;
      const patch: Partial<ImageLayer> = { src: a.url };
      if (l.role === 'logo' && aspect) Object.assign(patch, { aspect, w: Math.round(l.h * aspect) });
      updateLayer(l.id, patch);
      return;
    }
    const cw = doc.width - fmt.safe.left - fmt.safe.right;
    if (picker.tab === 'logo') {
      const lh = Math.round(doc.width * 0.07);
      const ar = aspect ?? 1;
      addLayer(imageLayer({ name: a.name, src: a.url, role: 'logo', fit: 'contain', aspect: ar, x: fmt.safe.left, y: doc.height - fmt.safe.bottom - lh, w: Math.round(lh * ar), h: lh }));
      return;
    }
    const isShot = picker.tab === 'screenshot';
    const w = Math.round(isShot ? cw : cw * 0.8);
    const hh = Math.round(aspect ? Math.min(doc.height * 0.55, w / aspect + (isShot ? 46 : 0)) : w * 0.62);
    addLayer(
      imageLayer({
        name: isShot ? 'Captura real' : a.name,
        src: a.url,
        role: isShot ? 'screenshot' : 'image',
        frame: isShot ? 'browser' : 'none',
        shadow: isShot,
        radius: isShot ? 22 : 16,
        x: Math.round((doc.width - w) / 2),
        y: Math.round(doc.height / 2 - hh / 2),
        w,
        h: hh,
      }),
    );
  };

  // ─── Save / autosave ─────────────────────────────────────────────────────

  const save = useCallback(async () => {
    const d = h.docRef.current;
    if (!d || !meta || !id) return;
    const v = versionRef.current;
    setSaveState('saving');
    try {
      const thumbnail = await makeThumbnail(d).catch(() => null);
      await api(`/api/marketing/designs/${id}`, {
        method: 'PUT',
        json: { name: meta.name.trim() || 'Sin título', status: meta.status, campaignId: meta.campaignId, doc: d, thumbnail },
      });
      savedVersion.current = v;
      setSaveState(versionRef.current === v ? 'saved' : 'dirty');
    } catch (e) {
      setSaveState('error');
      alertMessage((e as Error).message);
    }
  }, [h.docRef, meta, id]);

  useEffect(() => {
    if (!doc || !meta) return;
    if (totalVersion === savedVersion.current) return;
    setSaveState('dirty');
    const t = setTimeout(() => save(), 2200);
    return () => clearTimeout(t);
  }, [totalVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchMeta = (p: Partial<NonNullable<typeof meta>>) => {
    setMeta((m) => (m ? { ...m, ...p } : m));
    setMetaTick((t) => t + 1);
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  // ─── Export / duplicate / adapt ──────────────────────────────────────────

  const doExport = async (format: ImageFormat) => {
    setExportOpen(false);
    const d = h.docRef.current;
    if (!d || !meta) return;
    if (render.placeholders.length) {
      const ok = await confirmAction(`Hay ${render.placeholders.length} espacio(s) de imagen sin completar. ¿Exportar igual?`, 'Exportar igual');
      if (!ok) return;
    }
    setExporting(true);
    try {
      const { blob } = await exportDesign(d, format);
      downloadBlob(blob, `${slugify(meta.name)}-${d.format}-${d.width}x${d.height}.${format}`);
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const duplicateDesign = async () => {
    const d = h.docRef.current;
    if (!d || !meta) return;
    try {
      await save();
      const { id: newId } = await saveNewDesign(`${meta.name} (copia)`, cloneDoc(d), meta.campaignId, 'DRAFT');
      toastSuccess('Diseño duplicado');
      router.push(`/superadmin/marketing/editor/${newId}`);
    } catch (e) {
      alertMessage((e as Error).message);
    }
  };

  const adaptTo = async (format: FormatId) => {
    const d = h.docRef.current;
    if (!d || !meta || !d.templateId) return;
    const { content, screenshot } = contentFromDoc(d);
    const next = buildFromTemplate(d.templateId, format, { ...content, headline: content.headline || meta.name }, kit);
    if (screenshot) next.layers = next.layers.map((l) => (l.type === 'image' && l.role === 'screenshot' ? { ...l, src: screenshot } : l));
    next.background = { ...next.background, ...(d.background.imageUrl ? { imageUrl: d.background.imageUrl, imageOpacity: d.background.imageOpacity } : {}) };
    try {
      await save();
      const { id: newId } = await saveNewDesign(`${meta.name} · ${FORMATS[format].short}`, next, meta.campaignId, 'DRAFT');
      toastSuccess(`Copia creada en formato ${FORMATS[format].short}`);
      router.push(`/superadmin/marketing/editor/${newId}`);
    } catch (e) {
      alertMessage((e as Error).message);
    }
  };

  // ─── Keyboard ────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (!selectedId) return;
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateLayer(selectedId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteLayer(selectedId);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const l = h.docRef.current?.layers.find((x) => x.id === selectedId);
        if (!l || l.locked) return;
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        updateLayer(selectedId, { x: l.x + dx, y: l.y + dy }, { mergeKey: `${selectedId}:nudge` });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, undo, redo, selectedId, duplicateLayer, deleteLayer, updateLayer, h.docRef]);

  const onEditText = useCallback((lid: string) => {
    setSelectedId(lid);
    setTimeout(() => textRef.current?.focus(), 30);
  }, []);
  const onRender = useCallback((r: RenderResult) => setRender(r), []);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <StudioLayout title="Diseño no encontrado">
        <p className="text-sm text-muted-foreground">
          Este diseño no existe o fue eliminado.{' '}
          <Link href="/superadmin/marketing/designs" className="text-primary underline">
            Volver a Diseños
          </Link>
        </p>
      </StudioLayout>
    );
  }

  const warnings = doc ? outsideSafe(doc, render.textHeights) : [];
  const saveLabel = { saved: 'Guardado', dirty: 'Cambios sin guardar', saving: 'Guardando…', error: 'Error al guardar' }[saveState];

  return (
    <StudioLayout title={meta?.name || 'Editor'} bleed>
      {!doc || !meta || !fmt ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex h-[calc(100vh-0px)] min-h-0 flex-col max-md:h-[calc(100vh-49px)]">
          {/* Top bar */}
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
            <IconBtn label="Volver a Diseños" onClick={() => router.push(meta.campaignId ? `/superadmin/marketing/campaigns/${meta.campaignId}` : '/superadmin/marketing/designs')}>
              <ArrowLeft className="h-4 w-4" />
            </IconBtn>
            <input
              value={meta.name}
              onChange={(e) => patchMeta({ name: e.target.value })}
              className="min-w-0 max-w-[260px] flex-1 rounded-md bg-transparent px-2 py-1 font-heading text-sm font-semibold hover:bg-accent/50 focus:bg-accent/60 focus:outline-none"
              aria-label="Nombre del diseño"
            />
            <span className="hidden font-mono text-[11px] text-muted-foreground lg:inline">
              {fmt.short} · {fmt.width}×{fmt.height}
            </span>
            <span
              className={cn(
                'ml-1 hidden items-center gap-1.5 text-[11px] sm:inline-flex',
                saveState === 'error' ? 'text-destructive' : saveState === 'saved' ? 'text-muted-foreground' : 'text-warning',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', saveState === 'saved' ? 'bg-success' : saveState === 'error' ? 'bg-destructive' : 'bg-warning')} />
              {saveLabel}
            </span>
            <div className="flex-1" />
            <Select value={meta.campaignId ?? ''} onChange={(e) => patchMeta({ campaignId: e.target.value || null })} className="hidden h-8 w-44 py-0 text-xs xl:block">
              <option value="">Sin campaña</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={meta.status} onChange={(e) => patchMeta({ status: e.target.value as DesignStatus })} className="h-8 w-36 py-0 text-xs">
              <option value="DRAFT">Borrador</option>
              <option value="REVIEW">En revisión</option>
              <option value="APPROVED">Aprobado</option>
            </Select>
            <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <IconBtn label="Deshacer (Ctrl+Z)" onClick={undo} disabled={!h.canUndo}>
              <Undo2 className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Rehacer (Ctrl+Shift+Z)" onClick={redo} disabled={!h.canRedo}>
              <Redo2 className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Duplicar diseño" onClick={duplicateDesign}>
              <Copy className="h-4 w-4" />
            </IconBtn>
            <div className="relative">
              <Btn variant="primary" size="sm" loading={exporting} onClick={() => setExportOpen((o) => !o)}>
                {!exporting && <Download className="h-3.5 w-3.5" />}
                Exportar
              </Btn>
              {exportOpen && (
                <div className="absolute right-0 top-10 z-40 w-56 rounded-xl border border-border bg-card p-1.5 shadow-2xl" onMouseLeave={() => setExportOpen(false)}>
                  {(['png', 'jpg'] as ImageFormat[]).map((f) => (
                    <button key={f} onClick={() => doExport(f)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent">
                      <span className="font-medium uppercase">{f}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {doc.width}×{doc.height}
                      </span>
                    </button>
                  ))}
                  <p className="px-3 pb-1.5 pt-1 text-[11px] leading-snug text-muted-foreground">PNG para máxima calidad. JPG pesa menos.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Left: add tools + layers */}
            <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
              <div className="p-3">
                <Segmented
                  className="w-full [&>button]:flex-1"
                  value={leftTab}
                  onChange={setLeftTab}
                  options={[
                    { value: 'add', label: 'Agregar' },
                    { value: 'layers', label: <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Capas ({doc.layers.length})</span> },
                  ]}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                {leftTab === 'add' ? (
                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Texto</p>
                      <div className="space-y-1.5">
                        <button onClick={() => addText('titular')} className="w-full rounded-lg border border-border px-3 py-2.5 text-left font-heading text-lg font-extrabold leading-none tracking-tight hover:border-primary">
                          Titular
                        </button>
                        <button onClick={() => addText('texto')} className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary">
                          Texto
                        </button>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button onClick={() => addText('etiqueta')} className="rounded-lg border border-border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-widest hover:border-primary">
                            Etiqueta
                          </button>
                          <button onClick={() => addText('cta')} className="rounded-lg border border-border px-2 py-1.5 hover:border-primary">
                            <span className="inline-block rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">CTA</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Imágenes</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button onClick={() => setPicker({ mode: 'add', tab: 'screenshot' })} className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-2.5 text-left text-xs hover:border-primary">
                          <ImagePlus className="h-4 w-4 text-primary" />
                          Captura real
                        </button>
                        <button onClick={() => setPicker({ mode: 'add', tab: 'photo' })} className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-2.5 text-left text-xs hover:border-primary">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          Foto
                        </button>
                        <button onClick={() => setPicker({ mode: 'add', tab: 'logo' })} className="col-span-2 flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-left text-xs hover:border-primary">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/favicon.png" alt="" className="h-5 w-5 object-contain" />
                          Logo original
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Formas</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button title="Rectángulo" onClick={() => addShape('rect')} className="flex h-12 items-center justify-center rounded-lg border border-border hover:border-primary">
                          <Square className="h-5 w-5" />
                        </button>
                        <button title="Círculo" onClick={() => addShape('ellipse')} className="flex h-12 items-center justify-center rounded-lg border border-border hover:border-primary">
                          <Circle className="h-5 w-5" />
                        </button>
                        <button title="Línea" onClick={() => addShape('line')} className="flex h-12 items-center justify-center rounded-lg border border-border hover:border-primary">
                          <Minus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg bg-accent/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                      <p className="mb-1 font-semibold text-foreground">Atajos</p>
                      Doble clic en un texto para editarlo · Flechas para mover (Shift ×10) · Ctrl+D duplica · Supr elimina · Alt al arrastrar desactiva los imanes · Shift mantiene la proporción.
                    </div>
                  </div>
                ) : (
                  <LayersPanel layers={doc.layers} selectedId={selectedId} onSelect={setSelectedId} onToggle={toggleLayer} onMove={moveLayer} onDuplicate={duplicateLayer} onDelete={deleteLayer} />
                )}
              </div>
            </aside>

            {/* Center: stage */}
            <div className="relative flex min-w-0 flex-1 flex-col bg-background">
              <Stage
                doc={doc}
                zoom={zoom}
                selectedId={selectedId}
                showSafe={showSafe}
                onSelect={setSelectedId}
                onLayerChange={onLayerDrag}
                onDragEnd={endTransient}
                onRender={onRender}
                onEditText={onEditText}
                onScaleChange={setScale}
              />
              <div className="flex h-11 shrink-0 items-center gap-2 border-t border-border bg-card px-3 text-xs">
                <button
                  onClick={() => setShowSafe((s) => !s)}
                  className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2', showSafe ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  <Grid3x3 className="h-3.5 w-3.5" />
                  Zona segura
                </button>
                {warnings.length > 0 ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-warning" title={warnings.map((w) => w.name).join(', ')}>
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    Fuera de zona segura: {warnings.map((w) => w.name).join(', ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Todo dentro de la zona segura</span>
                )}
                {render.placeholders.length > 0 && (
                  <span className="hidden items-center gap-1.5 text-warning md:inline-flex">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {render.placeholders.length} imagen(es) sin elegir
                  </span>
                )}
                <div className="flex-1" />
                <IconBtn label="Alejar" onClick={() => setZoom(Math.max(0.1, Math.round((scale - 0.1) * 10) / 10))}>
                  <Minus className="h-3.5 w-3.5" />
                </IconBtn>
                <button onClick={() => setZoom('fit')} className="w-14 font-mono text-[11px] text-muted-foreground hover:text-foreground" title="Ajustar a la pantalla">
                  {Math.round(scale * 100)}%
                </button>
                <IconBtn label="Acercar" onClick={() => setZoom(Math.min(2, Math.round((scale + 0.1) * 10) / 10))}>
                  <Plus className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>

            {/* Right: properties */}
            <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-border bg-card md:block">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <Type className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{selected ? 'Propiedades de la capa' : 'Propiedades de la pieza'}</span>
              </div>
              <PropertiesPanel
                doc={doc}
                selected={selected}
                kit={kit}
                textHeight={selected ? render.textHeights[selected.id] ?? selected.h : 0}
                naturalWidth={naturalWidth}
                textRef={textRef}
                onLayer={onLayerFromPanel}
                onBackground={onBackground}
                onReplaceImage={(lid) => setPicker({ mode: 'replace', layerId: lid })}
                onPickBackgroundImage={() => setPicker({ mode: 'background' })}
                onAdapt={adaptTo}
              />
            </aside>
          </div>
        </div>
      )}

      <AssetPicker
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        onPick={onPicked}
        initialTab={
          picker?.mode === 'add'
            ? picker.tab
            : picker?.mode === 'replace'
              ? (() => {
                  const l = doc?.layers.find((x) => x.id === picker.layerId);
                  return l?.type === 'image' && l.role === 'logo' ? 'logo' : l?.type === 'image' && l.role === 'image' ? 'photo' : 'screenshot';
                })()
              : 'photo'
        }
      />
    </StudioLayout>
  );
}
