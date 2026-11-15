import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// WALTI Desktop's offline replacement for Cloudinary (see
// src/lib/uploadImage.ts) — product/combo/business images are written to
// disk instead of uploaded to a remote service. Defaults to a project-local
// folder for `npm run dev:desktop`; the real Electron shell points
// WALTI_IMAGES_DIR at app.getPath('userData')/images instead.
function imagesRoot(): string {
  return process.env.WALTI_IMAGES_DIR || path.join(process.cwd(), '.data', 'images');
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function saveLocalImage(businessId: string, contentType: string, base64Data: string): string {
  const ext = EXT_BY_MIME[contentType];
  if (!ext) throw new Error('Tipo de imagen no soportado');

  const dir = path.join(imagesRoot(), businessId);
  mkdirSync(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  writeFileSync(path.join(dir, filename), Buffer.from(base64Data, 'base64'));
  return `/api/local-images/file/${businessId}/${filename}`;
}

export function readLocalImage(segments: string[]): { buffer: Buffer; contentType: string } | null {
  const root = path.resolve(imagesRoot());
  const filePath = path.resolve(root, ...segments);

  // Path-traversal guard: the resolved path must stay inside the images
  // root no matter what businessId/filename segments were requested.
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;
  if (!existsSync(filePath)) return null;

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)?.[0];
  if (!contentType) return null;

  return { buffer: readFileSync(filePath), contentType };
}
