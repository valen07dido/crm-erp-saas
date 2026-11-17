import { z } from 'zod';

// Server-side shapes for Marketing Studio payloads. Design docs are validated
// structurally (format + arrays), not field by field: they're only ever
// produced and consumed by the Studio's own editor.

export const formatSchema = z.enum(['story', 'post', 'portrait', 'reel-cover']);
export const designStatusSchema = z.enum(['DRAFT', 'REVIEW', 'APPROVED']);
export const campaignStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'FINISHED']);
export const assetCategorySchema = z.enum(['logo', 'screenshot', 'photo', 'video', 'icon', 'template', 'other']);

export const designDocSchema = z
  .object({
    version: z.literal(1),
    format: formatSchema,
    width: z.number().positive(),
    height: z.number().positive(),
    background: z.object({}).passthrough(),
    layers: z.array(z.object({ id: z.string(), type: z.enum(['text', 'image', 'shape']) }).passthrough()).max(200),
  })
  .passthrough();

export const briefSchema = z.object({
  objective: z.string().max(500).default(''),
  audience: z.enum(['general', 'minorista', 'distribuidora', 'emprendedor', 'pyme']).default('general'),
  audienceNotes: z.string().max(500).default(''),
  mainMessage: z.string().max(300).default(''),
  offer: z.string().max(500).default(''),
  channels: z.array(z.string().max(40)).max(10).default([]),
  startDate: z.string().max(20).default(''),
  endDate: z.string().max(20).default(''),
  features: z.array(z.string().max(40)).max(20).default([]),
  pieces: z
    .object({
      stories: z.number().int().min(0).max(50),
      posts: z.number().int().min(0).max(50),
      carousels: z.number().int().min(0).max(50),
      reels: z.number().int().min(0).max(50),
    })
    .default({ stories: 0, posts: 0, carousels: 0, reels: 0 }),
});

export const brandKitSchema = z.object({
  colors: z.array(z.object({ name: z.string().max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), role: z.string().max(80) })).max(16),
  whatsapp: z.string().max(30),
  cta: z.string().max(120),
  instagram: z.string().max(60),
  website: z.string().max(120),
  tagline: z.string().max(160),
});

/** Only files uploaded to this project's own Cloudinary account are accepted as assets. */
export function isOwnCloudinaryUrl(url: string): boolean {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  return url.startsWith(`https://res.cloudinary.com/${cloud}/`);
}
