import { useCallback, useEffect, useState } from 'react';
import type { AssetCategory, AssetRecord, BrandKit, DesignDoc, DesignRecord, DesignStatus, FormatId } from './types';
import { DEFAULT_BRAND_KIT } from './brand';
import { buildFromTemplate, cloneDoc, type TemplateContent } from './templates';
import { downloadBlob, exportDesign, makeThumbnail, slugify } from './export';
import { stripEmphasis } from './copy';

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  return data as T;
}

// ─── Brand kit ──────────────────────────────────────────────────────────────

let kitCache: BrandKit | null = null;

export function useBrandKit() {
  const [kit, setKit] = useState<BrandKit>(kitCache ?? DEFAULT_BRAND_KIT);
  const [loaded, setLoaded] = useState(Boolean(kitCache));
  useEffect(() => {
    let alive = true;
    api<BrandKit>('/api/marketing/brand')
      .then((k) => {
        kitCache = k;
        if (alive) {
          setKit(k);
          setLoaded(true);
        }
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  const save = useCallback(async (next: BrandKit) => {
    const saved = await api<BrandKit>('/api/marketing/brand', { method: 'PUT', json: next });
    kitCache = saved;
    setKit(saved);
    return saved;
  }, []);
  return { kit, loaded, save };
}

// ─── AI availability ────────────────────────────────────────────────────────

export function useAiStatus() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    api<{ enabled: boolean }>('/api/marketing/ai')
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}

// ─── Uploads ────────────────────────────────────────────────────────────────

export const MAX_IMAGE_MB = 15;
export const MAX_VIDEO_MB = 95;

export async function uploadAsset(file: File, category: AssetCategory, name?: string): Promise<AssetRecord> {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) throw new Error('Solo se pueden subir imágenes o videos');
  const limit = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
  if (file.size > limit * 1024 * 1024) throw new Error(`El archivo supera ${limit} MB`);

  const sig = await api<{ signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string }>(
    '/api/marketing/upload-signature',
    { method: 'POST' },
  );
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/${isVideo ? 'video' : 'image'}/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await up.json();
  if (!up.ok) throw new Error(data?.error?.message || 'No se pudo subir el archivo');

  return api<AssetRecord>('/api/marketing/assets', {
    method: 'POST',
    json: {
      name: (name || file.name.replace(/\.[^.]+$/, '')).slice(0, 160),
      category: isVideo ? 'video' : category,
      url: data.secure_url,
      mimeType: file.type || null,
      width: data.width ?? null,
      height: data.height ?? null,
      tags: [],
    },
  });
}

// ─── Designs ────────────────────────────────────────────────────────────────

export interface NewDesignInput {
  name: string;
  templateId: string;
  format: FormatId;
  content: TemplateContent;
  kit: BrandKit;
  campaignId?: string | null;
  status?: DesignStatus;
}

export async function saveNewDesign(name: string, doc: DesignDoc, campaignId?: string | null, status: DesignStatus = 'DRAFT') {
  const thumbnail = await makeThumbnail(doc).catch(() => null);
  return api<{ id: string }>('/api/marketing/designs', {
    method: 'POST',
    json: { name: name.slice(0, 120), format: doc.format, status, doc, thumbnail, campaignId: campaignId ?? null },
  });
}

export async function createDesign(input: NewDesignInput) {
  const doc = buildFromTemplate(input.templateId, input.format, input.content, input.kit);
  return saveNewDesign(input.name, doc, input.campaignId, input.status);
}

export function shortName(text: string, max = 48): string {
  const t = stripEmphasis(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t || 'Sin título';
}

// ─── Gallery actions ────────────────────────────────────────────────────────

export async function fetchDesign(id: string) {
  return api<DesignRecord>(`/api/marketing/designs/${id}`);
}

export async function duplicateDesignById(id: string) {
  const d = await fetchDesign(id);
  return saveNewDesign(`${d.name} (copia)`, cloneDoc(d.doc), d.campaignId, 'DRAFT');
}

export async function deleteDesignById(id: string) {
  await api(`/api/marketing/designs/${id}`, { method: 'DELETE' });
}

export async function exportDesignById(id: string, format: 'png' | 'jpg') {
  const d = await fetchDesign(id);
  const { blob } = await exportDesign(d.doc, format);
  downloadBlob(blob, `${slugify(d.name)}-${d.doc.format}-${d.doc.width}x${d.doc.height}.${format}`);
}
