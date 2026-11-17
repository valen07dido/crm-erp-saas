import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';
import { DEFAULT_BRAND_KIT } from '@/lib/marketing/brand';
import { brandKitSchema } from '@/lib/marketing/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSuperAdmin(req, res))) return;

  if (req.method === 'GET') {
    const row = await prisma.marketingBrandKit.findUnique({ where: { id: 'default' } });
    return res.status(200).json({ ...DEFAULT_BRAND_KIT, ...((row?.data as object) ?? {}) });
  }

  if (req.method === 'PUT') {
    const parsed = brandKitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos del brand kit inválidos' });
    await prisma.marketingBrandKit.upsert({
      where: { id: 'default' },
      create: { id: 'default', data: parsed.data },
      update: { data: parsed.data },
    });
    return res.status(200).json(parsed.data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
