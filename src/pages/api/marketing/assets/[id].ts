import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { assetCategorySchema } from '@/lib/marketing/validation';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  category: assetCategorySchema.optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;
  const id = String(req.query.id);

  if (req.method === 'PUT') {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos del recurso inválidos' });
    try {
      return res.status(200).json(await prisma.marketingAsset.update({ where: { id }, data: parsed.data }));
    } catch {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
  }

  if (req.method === 'DELETE') {
    // Removes it from the library. The Cloudinary file stays, so designs that
    // already use it keep rendering.
    try {
      await prisma.marketingAsset.delete({ where: { id } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
