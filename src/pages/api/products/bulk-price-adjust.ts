import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

/**
 * Bulk price change for a hand-picked set of products belonging to the
 * tenant — e.g. "+15% to every product in 'Almacén'" or "-10% to these 6
 * selected products". Scoping/filtering (by category or selection) happens
 * client-side; this endpoint just receives the final list of product ids.
 */
function applyAdjustment(price: number, direction: 'increase' | 'decrease', type: 'percent' | 'fixed', value: number): number {
  const delta = type === 'percent' ? price * (value / 100) : value;
  const result = direction === 'increase' ? price + delta : price - delta;
  return Math.max(0, Math.round(result * 100) / 100);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { productIds, direction, type, value } = req.body as {
      productIds?: string[];
      direction?: 'increase' | 'decrease';
      type?: 'percent' | 'fixed';
      value?: number;
    };

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'No se seleccionaron productos' });
    }
    if (direction !== 'increase' && direction !== 'decrease') {
      return res.status(400).json({ error: 'Dirección de ajuste inválida' });
    }
    if (type !== 'percent' && type !== 'fixed') {
      return res.status(400).json({ error: 'Tipo de ajuste inválido' });
    }
    const numValue = Number(value);
    if (!(numValue > 0)) {
      return res.status(400).json({ error: 'El valor del ajuste debe ser mayor a 0' });
    }

    // Scope strictly to this business — ids are client-supplied, so never
    // trust them without this filter.
    const targets = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: { id: true, price: true },
    });

    const updated = await prisma.$transaction(
      targets.map((p) =>
        prisma.product.update({
          where: { id: p.id },
          data: { price: applyAdjustment(Number(p.price), direction, type, numValue) },
        })
      )
    );

    return res.status(200).json({ products: updated });
  } catch (error) {
    console.error('Bulk price adjust error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
