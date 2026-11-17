import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { briefSchema, campaignStatusSchema } from '@/lib/marketing/validation';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: campaignStatusSchema.optional(),
  brief: briefSchema.optional(),
  content: z.any().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;
  const id = String(req.query.id);

  if (req.method === 'GET') {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      include: {
        designs: {
          select: { id: true, name: true, format: true, status: true, thumbnail: true, updatedAt: true, createdAt: true, campaignId: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    return res.status(200).json(campaign);
  }

  if (req.method === 'PUT') {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Revisá los datos de la campaña' });
    const { content, ...rest } = parsed.data;
    try {
      const updated = await prisma.marketingCampaign.update({
        where: { id },
        data: {
          ...rest,
          ...(content !== undefined ? { content: content === null ? Prisma.DbNull : content } : {}),
        },
      });
      return res.status(200).json(updated);
    } catch {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
  }

  if (req.method === 'DELETE') {
    // Designs are kept (campaignId → null via onDelete: SetNull), never lost with the campaign.
    try {
      await prisma.marketingCampaign.delete({ where: { id } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
