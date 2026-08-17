import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

/**
 * Simple CRUD API for Product model.
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
        // List products for the given business
        const products = await prisma.product.findMany({
          where: { businessId },
          orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json(products);
      }
      case 'POST': {
        // Create a new product
        const { name, description, price, stock, imageUrl, barcode } = req.body as {
          name: string;
          description?: string;
          price?: number;
          stock?: number;
          imageUrl?: string;
          barcode?: string;
        };
        if (!name) {
          return res.status(400).json({ error: 'Product name is required' });
        }
        const product = await prisma.product.create({
          data: {
            name,
            description,
            price: price ?? 0,
            stock: stock ?? 0,
            imageUrl: req.body.imageUrl || null,
            barcode: barcode || null,
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
        const data = req.body as Partial<{
          name: string;
          description: string;
          price: number;
          stock: number;
          imageUrl: string;
          barcode: string;
        }>;
        const product = await prisma.product.update({
          where: { id },
          data,
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
