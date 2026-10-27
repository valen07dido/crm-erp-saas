import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

/**
 * Simple CRUD API for Product model.
 * The tenant (business) is identified via the `x-business-id` header.
 */

// Price is never negative; stock is never negative, and only a weighable
// product can carry a fractional quantity (kg) — any other product's stock
// is a whole unit count.
function sanitizeStock(stock: number, soldByWeight: boolean): number {
  const n = Math.max(0, Number(stock) || 0);
  return soldByWeight ? n : Math.round(n);
}
function sanitizePrice(price: number): number {
  return Math.max(0, Number(price) || 0);
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        // List products for the given business
        const products = await prisma.product.findMany({
          where: { businessId },
          orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json(products);
      }
      case 'POST': {
        // Create a new product
        const { name, description, price, stock, imageUrl, barcode, category, expirationDate, soldByWeight } = req.body as {
          name: string;
          description?: string;
          price?: number;
          stock?: number;
          imageUrl?: string;
          barcode?: string;
          category?: string;
          expirationDate?: string | null;
          soldByWeight?: boolean;
        };
        if (!name) {
          return res.status(400).json({ error: 'Product name is required' });
        }
        const product = await prisma.product.create({
          data: {
            name,
            description,
            price: sanitizePrice(price ?? 0),
            stock: sanitizeStock(stock ?? 0, soldByWeight ?? false),
            imageUrl: req.body.imageUrl || null,
            barcode: barcode || null,
            category: category || null,
            expirationDate: expirationDate ? new Date(expirationDate) : null,
            soldByWeight: soldByWeight ?? false,
            business: { connect: { id: businessId } },
          },
        });
        return res.status(201).json(product);
      }
      case 'PUT': {
        // Update an existing product – expect id in query
        const { id } = req.query as { id: string };
        if (!id) {
          return res.status(400).json({ error: 'Product id is required in query' });
        }
        const body = req.body as Partial<{
          name: string;
          description: string;
          price: number;
          stock: number;
          imageUrl: string;
          barcode: string;
          expirationDate: string | null;
          soldByWeight: boolean;
        }>;
        const { expirationDate, price, stock, soldByWeight, ...rest } = body;
        let effectiveSoldByWeight = soldByWeight;
        if (stock !== undefined && effectiveSoldByWeight === undefined) {
          const existing = await prisma.product.findUnique({ where: { id }, select: { soldByWeight: true } });
          effectiveSoldByWeight = existing?.soldByWeight ?? false;
        }
        const product = await prisma.product.update({
          where: { id },
          data: {
            ...rest,
            ...(soldByWeight !== undefined && { soldByWeight }),
            ...(price !== undefined && { price: sanitizePrice(price) }),
            ...(stock !== undefined && { stock: sanitizeStock(stock, effectiveSoldByWeight ?? false) }),
            ...(expirationDate !== undefined && { expirationDate: expirationDate ? new Date(expirationDate) : null }),
          },
        });
        return res.status(200).json(product);
      }
      case 'DELETE': {
        // Delete a product – expect id in query
        const { id } = req.query as { id: string };
        if (!id) {
          return res.status(400).json({ error: 'Product id is required in query' });
        }
        await prisma.product.delete({ where: { id } });
        return res.status(204).end();
      }
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
