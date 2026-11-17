import React, { useEffect, useMemo, useState } from 'react';
import { Clapperboard, Download, FileDown, FolderOpen } from 'lucide-react';
import StudioLayout from '@/components/marketing/studio-layout';
import { DesignThumb } from '@/components/marketing/design-card';
import { Btn, EmptyState, Panel, Segmented, Spinner, StatusPill } from '@/components/marketing/studio-ui';
import type { DesignRecord } from '@/lib/marketing/types';
import { FORMATS } from '@/lib/marketing/formats';
import { buildPdf, buildZip, downloadBlob, exportDesign, slugify, type ImageFormat } from '@/lib/marketing/export';
import { api } from '@/lib/marketing/client';
import { alertMessage, confirmAction, toastSuccess } from '@/lib/alerts';
import { cn } from '@/lib/utils';

interface Group {
  key: string;
  name: string;
  designs: DesignRecord[];
}

export default function ExportsPage() {
  const [designs, setDesigns] = useState<DesignRecord[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ImageFormat>('png');
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  useEffect(() => {
    api<DesignRecord[]>('/api/marketing/designs?full=1')
      .then(setDesigns)
      .catch((e) => {
        alertMessage(e.message);
        setDesigns([]);
      });
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const d of designs ?? []) {
      if (onlyApproved && d.status !== 'APPROVED') continue;
      const key = d.campaign?.id ?? 'none';
      if (!map.has(key)) map.set(key, { key, name: d.campaign?.name ?? 'Sin campaña', designs: [] });
      map.get(key)!.designs.push(d);
    }
    return Array.from(map.values()).sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name)));
  }, [designs, onlyApproved]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleGroup = (g: Group) =>
    setSelected((s) => {
      const n = new Set(s);
      const all = g.designs.every((d) => n.has(d.id));
      g.designs.forEach((d) => (all ? n.delete(d.id) : n.add(d.id)));
      return n;
    });

  const picked = (designs ?? []).filter((d) => selected.has(d.id));
  const groupName = (d: DesignRecord) => slugify(d.campaign?.name ?? 'sin-campana');

  const exportZip = async () => {
    if (!picked.length) return;
    const withDrafts = picked.filter((d) => d.status !== 'APPROVED').length;
    if (withDrafts && !(await confirmAction(`${withDrafts} de las piezas elegidas no están aprobadas. ¿Exportarlas igual?`, 'Exportar'))) return;
    const files: { name: string; blob: Blob }[] = [];
    let placeholders = 0;
    try {
      for (const [i, d] of picked.entries()) {
        setProgress({ done: i, total: picked.length, label: d.name });
        const out = await exportDesign(d.doc, format);
        placeholders += out.placeholders;
        files.push({ name: `${groupName(d)}/${String(i + 1).padStart(2, '0')}-${slugify(d.name)}-${d.doc.width}x${d.doc.height}.${format}`, blob: out.blob });
      }
      setProgress({ done: picked.length, total: picked.length, label: 'Armando ZIP…' });
      const zip = await buildZip(files);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(zip, `walti-piezas-${stamp}.zip`);
      toastSuccess(`${files.length} piezas exportadas`);
      if (placeholders) alertMessage(`Atención: ${placeholders} espacio(s) de imagen estaban sin completar en las piezas exportadas.`, 'warning');
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const exportPdf = async () => {
    if (!picked.length) return;
    try {
      setProgress({ done: 0, total: picked.length, label: 'Generando PDF…' });
      const pdf = await buildPdf(picked.map((d) => ({ name: d.name, doc: d.doc })));
      downloadBlob(pdf, `walti-presentacion-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <StudioLayout title="Exportar" subtitle="Descargá piezas en resolución original (1080 px de ancho), organizadas por campaña, o armá un PDF para presentaciones comerciales.">
      <div className="sticky top-0 z-20 -mx-1 mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
        <Segmented
          value={format}
          onChange={setFormat}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpg', label: 'JPG' },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={onlyApproved} onChange={(e) => setOnlyApproved(e.target.checked)} className="accent-[#D6F36A]" />
          Solo aprobadas
        </label>
        <span className="font-mono text-xs text-muted-foreground">{selected.size} elegidas</span>
        <div className="flex-1" />
        {progress ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="h-4 w-4" />
            {progress.done}/{progress.total} · {progress.label}
          </span>
        ) : null}
        <Btn variant="outline" disabled={!picked.length || Boolean(progress)} onClick={exportPdf}>
          <FileDown className="h-4 w-4" /> PDF presentación
        </Btn>
        <Btn variant="primary" disabled={!picked.length || Boolean(progress)} onClick={exportZip}>
          <Download className="h-4 w-4" /> Descargar ZIP
        </Btn>
      </div>

      <p className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Clapperboard className="h-3.5 w-3.5" /> Exportación MP4: llega con Reel Studio en la próxima etapa.
      </p>

      {!designs ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="No hay piezas para exportar" text={onlyApproved ? 'Ninguna pieza está aprobada todavía.' : 'Creá piezas desde Diseños o desde una campaña.'} />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const all = g.designs.every((d) => selected.has(d.id));
            return (
              <Panel
                key={g.key}
                title={
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={all} onChange={() => toggleGroup(g)} className="accent-[#D6F36A]" aria-label={`Elegir todo ${g.name}`} />
                    {g.name}
                    <span className="font-mono text-[11px] font-normal text-muted-foreground">{g.designs.length}</span>
                  </span>
                }
              >
                <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
                  {g.designs.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => toggle(d.id)}
                      className={cn('rounded-lg border p-2 text-left transition-colors', selected.has(d.id) ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/40')}
                    >
                      <div className="flex h-28 items-center justify-center">
                        <DesignThumb d={d} className="h-full" />
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-snug">{d.name}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <StatusPill status={d.status} />
                        <span className="font-mono text-[9px] text-muted-foreground">{FORMATS[d.format].short}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </StudioLayout>
  );
}
