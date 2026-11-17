import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { briefSchema, campaignStatusSchema } from '@/lib/marketing/validation';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: campaignStatusSchema.default('ACTIVE'),
  brief: briefSchema,
  content: z.any().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;

  if (req.method === 'GET') {
    const campaigns = await prisma.marketingCampaign.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        designs: {
          select: { id: true, name: true, format: true, status: true, thumbnail: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    return res.status(200).json(campaigns);
  }

  if (req.method === 'POST') {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Revisá los datos de la campaña' });
    const created = await prisma.marketingCampaign.create({
      data: {
        name: parsed.data.name,
        status: parsed.data.status,
        brief: parsed.data.brief,
        content: parsed.data.content ?? undefined,
      },
    });
    return res.status(201).json(created);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
