import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { assetCategorySchema, isOwnCloudinaryUrl } from '@/lib/marketing/validation';

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: assetCategorySchema,
  url: z.string().url().max(600),
  mimeType: z.string().max(80).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;

  if (req.method === 'GET') {
    const { category } = req.query;
    const assets = await prisma.marketingAsset.findMany({
      where: typeof category === 'string' && assetCategorySchema.safeParse(category).success ? { category } : {},
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(assets);
  }

  if (req.method === 'POST') {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos del recurso inválidos' });
    if (!isOwnCloudinaryUrl(parsed.data.url)) {
      return res.status(400).json({ error: 'El archivo tiene que estar subido desde el Studio' });
    }
    const created = await prisma.marketingAsset.create({ data: parsed.data });
    return res.status(201).json(created);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
