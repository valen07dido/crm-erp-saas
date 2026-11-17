import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import type { AssetCategory, AssetRecord } from '@/lib/marketing/types';
import { BUILTIN_LOGOS } from '@/lib/marketing/brand';
import { api, uploadAsset } from '@/lib/marketing/client';
import { alertMessage } from '@/lib/alerts';
import { cn } from '@/lib/utils';
import { Btn, EmptyState, Modal, Segmented, Spinner } from './studio-ui';

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  logo: 'Logos',
  screenshot: 'Capturas',
  photo: 'Fotos',
  video: 'Videos',
  icon: 'Íconos',
  template: 'Plantillas',
  other: 'Otros',
};

export function useAssets() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setAssets(await api<AssetRecord[]>('/api/marketing/assets'));
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { assets, setAssets, loading, reload };
}

export function UploadButton({
  category,
  onUploaded,
  accept = 'image/*',
  label = 'Subir',
  variant = 'outline',
  multiple = true,
}: {
  category: AssetCategory;
  onUploaded: (a: AssetRecord) => void;
  accept?: string;
  label?: string;
  variant?: 'outline' | 'primary' | 'secondary';
  multiple?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) onUploaded(await uploadAsset(f, category));
    } catch (e) {
      alertMessage((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <>
      <input ref={input} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <Btn variant={variant} size="sm" loading={busy} onClick={() => input.current?.click()}>
        {!busy && <Upload className="h-3.5 w-3.5" />}
        {busy ? 'Subiendo…' : label}
      </Btn>
    </>
  );
}

type PickerTab = 'screenshot' | 'logo' | 'photo' | 'icon' | 'other';

/** Image picker over the brand library (original logos + uploaded assets). */
export function AssetPicker({
  open,
  onClose,
  onPick,
  initialTab = 'screenshot',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (a: AssetRecord) => void;
  initialTab?: PickerTab;
}) {
  const { assets, setAssets, loading } = useAssets();
  const [tab, setTab] = useState<PickerTab>(initialTab);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const list = [...(tab === 'logo' ? BUILTIN_LOGOS : []), ...assets.filter((a) => a.category === tab)];

  return (
    <Modal open={open} onClose={onClose} title="Biblioteca de recursos" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={(['screenshot', 'logo', 'photo', 'icon', 'other'] as PickerTab[]).map((k) => ({ value: k, label: CATEGORY_LABELS[k] }))}
        />
        <UploadButton category={tab} onUploaded={(a) => setAssets((prev) => [a, ...prev])} label={`Subir a ${CATEGORY_LABELS[tab]}`} />
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ImagePlus className="h-5 w-5" />}
          title="Todavía no hay recursos acá"
          text={tab === 'screenshot' ? 'Subí capturas reales de WALTI para usarlas en las piezas.' : 'Subí archivos para tenerlos a mano en cada pieza.'}
        />
      ) : (
        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onPick(a);
                onClose();
              }}
              className="group overflow-hidden rounded-lg border border-border bg-background text-left transition-colors hover:border-primary"
            >
              <div className={cn('flex aspect-[4/3] items-center justify-center overflow-hidden', a.category === 'logo' ? 'bg-ivory p-4' : 'bg-black/30')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className={cn('max-h-full max-w-full', a.category === 'logo' ? 'object-contain' : 'h-full w-full object-cover object-top')} />
              </div>
              <div className="truncate px-2.5 py-2 text-xs text-muted-foreground group-hover:text-foreground">{a.name}</div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
