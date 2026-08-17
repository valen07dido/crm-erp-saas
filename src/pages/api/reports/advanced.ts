import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  try {
    // Top 5 Productos más vendidos
    const topProductsRaw = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { businessId, status: { not: 'CANCELLED' } }
      },
      _sum: { quantity: true, price: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const topProducts = await Promise.all(topProductsRaw.map(async (tp) => {
      const p = await prisma.product.findUnique({ where: { id: tp.productId } });
      return {
        id: p?.id,
        name: p?.name || 'Desconocido',
        quantity: tp._sum.quantity || 0,
        revenue: (tp._sum.quantity || 0) * Number(tp._sum.price || 0),
      };
    }));

    // Top 5 Clientes (excluyendo consumidor final / null)
    const topClientsRaw = await prisma.sale.groupBy({
      by: ['clientId'],
      where: {
        businessId,
        status: { not: 'CANCELLED' },
        clientId: { not: null }
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });

    const topClients = await Promise.all(topClientsRaw.map(async (tc) => {
      const c = await prisma.client.findUnique({ where: { id: tc.clientId! } });
      return {
        id: c?.id,
        name: c?.name || 'Desconocido',
        purchases: tc._count.id,
        spent: Number(tc._sum.total || 0),
      };
    }));

    return res.status(200).json({
      topProducts,
      topClients,
    });
  } catch (error) {
    console.error('Reports API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
