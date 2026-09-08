import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

/**
 * CRUD API for Combo (bundle of products sold at a fixed price) + its items.
 * The tenant (business) is identified via the `x-business-id` header.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const combos = await prisma.combo.findMany({
          where: { businessId },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json(combos);
      }
      case 'POST': {
        const { name, description, price, imageUrl, barcode, isActive, items } = req.body as {
          name: string;
          description?: string;
          price?: number;
          imageUrl?: string;
          barcode?: string;
          isActive?: boolean;
          items: { productId: string; quantity: number }[];
        };
        if (!name) return res.status(400).json({ error: 'El nombre del combo es obligatorio' });
        if (!Array.isArray(items) || items.length < 2) {
          return res.status(400).json({ error: 'Un combo necesita al menos 2 productos' });
        }

        const combo = await prisma.combo.create({
          data: {
            name,
            description: description || null,
            price: price ?? 0,
            imageUrl: imageUrl || null,
            barcode: barcode || null,
            isActive: isActive ?? true,
            business: { connect: { id: businessId } },
            items: {
              create: items.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
              })),
            },
          },
          include: { items: { include: { product: true } } },
        });
        return res.status(201).json(combo);
      }
      case 'PUT': {
        const { id } = req.query as { id: string };
        if (!id) return res.status(400).json({ error: 'Combo id is required in query' });

        const { name, description, price, imageUrl, barcode, isActive, items } = req.body as {
          name?: string;
          description?: string;
          price?: number;
          imageUrl?: string;
          barcode?: string;
          isActive?: boolean;
          items?: { productId: string; quantity: number }[];
        };

        if (items && (!Array.isArray(items) || items.length < 2)) {
          return res.status(400).json({ error: 'Un combo necesita al menos 2 productos' });
        }

        const combo = await prisma.$transaction(async (tx) => {
          if (items) {
            await tx.comboItem.deleteMany({ where: { comboId: id } });
          }
          return tx.combo.update({
            where: { id },
            data: {
              ...(name !== undefined && { name }),
              ...(description !== undefined && { description: description || null }),
              ...(price !== undefined && { price }),
              ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
              ...(barcode !== undefined && { barcode: barcode || null }),
              ...(isActive !== undefined && { isActive }),
              ...(items && {
                items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity })) },
              }),
            },
            include: { items: { include: { product: true } } },
          });
        });
        return res.status(200).json(combo);
      }
      case 'DELETE': {
        const { id } = req.query as { id: string };
        if (!id) return res.status(400).json({ error: 'Combo id is required in query' });
        await prisma.combo.delete({ where: { id } });
        return res.status(204).end();
      }
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Combos API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
