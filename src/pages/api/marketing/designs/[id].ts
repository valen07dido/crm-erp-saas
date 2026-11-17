import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { designDocSchema, designStatusSchema } from '@/lib/marketing/validation';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: designStatusSchema.optional(),
  doc: designDocSchema.optional(),
  thumbnail: z.string().startsWith('data:image/').max(1_500_000).nullable().optional(),
  campaignId: z.string().nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;
  const id = String(req.query.id);

  if (req.method === 'GET') {
    const design = await prisma.marketingDesign.findUnique({
      where: { id },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!design) return res.status(404).json({ error: 'Diseño no encontrado' });
    return res.status(200).json(design);
  }

  if (req.method === 'PUT') {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Diseño inválido' });
    const { doc, campaignId, ...rest } = parsed.data;
    try {
      const updated = await prisma.marketingDesign.update({
        where: { id },
        data: {
          ...rest,
          ...(doc ? { doc: doc as Prisma.InputJsonValue, format: doc.format } : {}),
          ...(campaignId !== undefined ? { campaignId: campaignId || null } : {}),
        },
        select: { id: true, name: true, status: true, updatedAt: true, campaignId: true },
      });
      return res.status(200).json(updated);
    } catch {
      return res.status(404).json({ error: 'Diseño no encontrado' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.marketingDesign.delete({ where: { id } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: 'Diseño no encontrado' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
