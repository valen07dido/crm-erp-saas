import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { designDocSchema, designStatusSchema, formatSchema } from '@/lib/marketing/validation';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  format: formatSchema,
  status: designStatusSchema.default('DRAFT'),
  doc: designDocSchema,
  thumbnail: z.string().startsWith('data:image/').max(1_500_000).nullable().optional(),
  campaignId: z.string().nullable().optional(),
});

const SUMMARY = {
  id: true,
  name: true,
  format: true,
  status: true,
  thumbnail: true,
  campaignId: true,
  createdAt: true,
  updatedAt: true,
  campaign: { select: { id: true, name: true } },
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;

  if (req.method === 'GET') {
    const { campaignId, format, full } = req.query;
    const where: Record<string, unknown> = {};
    if (typeof campaignId === 'string') where.campaignId = campaignId === 'none' ? null : campaignId;
    if (typeof format === 'string' && formatSchema.safeParse(format).success) where.format = format;
    const designs = await prisma.marketingDesign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      // `full=1` includes the editable document (used by bulk export).
      select: full === '1' ? { ...SUMMARY, doc: true } : SUMMARY,
    });
    return res.status(200).json(designs);
  }

  if (req.method === 'POST') {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Diseño inválido' });
    const { campaignId, ...data } = parsed.data;
    const created = await prisma.marketingDesign.create({
      data: { ...data, doc: data.doc as Prisma.InputJsonValue, campaignId: campaignId || null },
      select: SUMMARY,
    });
    return res.status(201).json(created);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
