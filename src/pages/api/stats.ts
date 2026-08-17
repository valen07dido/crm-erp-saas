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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Ventas de hoy
    const salesTodayAgg = await prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        businessId,
        createdAt: { gte: today },
        status: { not: 'CANCELLED' } // Opcional, asumimos que no hay canceladas por ahora
      }
    });
    const salesTodayTotal = salesTodayAgg._sum.total ? Number(salesTodayAgg._sum.total) : 0;

    // 2. Ventas del mes
    const salesMonthAgg = await prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        businessId,
        createdAt: { gte: firstDayOfMonth },
        status: { not: 'CANCELLED' }
      }
    });
    const salesMonthTotal = salesMonthAgg._sum.total ? Number(salesMonthAgg._sum.total) : 0;

    // 3. Productos en stock
    const productsAgg = await prisma.product.aggregate({
      _count: { id: true },
      where: {
        businessId,
        stock: { gt: 0 }
      }
    });
    const totalProducts = productsAgg._count.id;

    // 4. Total de clientes
    const clientsAgg = await prisma.client.aggregate({
      _count: { id: true },
      where: {
        businessId
      }
    });
    const totalClients = clientsAgg._count.id;

    // Fetch latest sales for the dashboard table
    const recentSales = await prisma.sale.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        client: { select: { name: true } }
      }
    });

    // Fetch low stock products (<= 5)
    const lowStockProducts = await prisma.product.findMany({
      where: { businessId, stock: { lte: 5 } },
      orderBy: { stock: 'asc' },
      take: 10,
    });

    return res.status(200).json({
      salesToday: salesTodayTotal,
      salesMonth: salesMonthTotal,
      productsInStock: totalProducts,
      totalClients: totalClients,
      recentSales: recentSales.map(sale => ({
        id: sale.id,
        total: Number(sale.total),
        status: sale.status,
        createdAt: sale.createdAt,
        clientName: sale.client?.name || 'Consumidor Final'
      })),
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
      }))
    });
  } catch (error) {
    console.error('Stats API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
