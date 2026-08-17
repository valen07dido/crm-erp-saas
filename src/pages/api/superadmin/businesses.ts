import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user?.email !== 'valendido69@gmail.com') {
    return res.status(403).json({ error: 'Forbidden. Super Admin access required.' });
  }

  if (req.method === 'GET') {
    try {
      const businesses = await prisma.business.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { businessUsers: true, products: true, sales: true },
          },
        },
      });

      return res.status(200).json(businesses);
    } catch (error) {
      console.error('Super Admin GET error', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, planName, planExpiresAt, isActive } = req.body;
      
      if (!id) return res.status(400).json({ error: 'Missing business ID' });

      const updated = await prisma.business.update({
        where: { id },
        data: {
          ...(planName && { planName }),
          ...(planExpiresAt !== undefined && { planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Super Admin PUT error', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
