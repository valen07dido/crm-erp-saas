import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

/**
 * Public endpoint (no auth required) to process orders from the storefront cart.
 * Creates a Sale with status PENDING_WEB so the business owner can see and manage it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { businessSlug, customerName, customerEmail, customerPhone, items } = req.body as {
    businessSlug: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    items: { productId: string; quantity: number }[];
  };

  if (!businessSlug || !customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Find the business
    const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    // 2. Validate products and compute total
    const products = await prisma.product.findMany({
      where: { id: { in: items.map(i => i.productId) }, businessId: business.id },
    });

    if (products.length !== items.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    let total = 0;
    const saleItems = items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      const lineTotal = Number(product.price) * item.quantity;
      total += lineTotal;
      return { productId: product.id, quantity: item.quantity, price: product.price };
    });

    // 3. Upsert client (find by email or create anonymous)
    let client = null;
    if (customerEmail) {
      client = await prisma.client.findFirst({
        where: { email: customerEmail, businessId: business.id },
      });
    }
    if (!client) {
      client = await prisma.client.create({
        data: {
          name: customerName,
          email: customerEmail || null,
          phone: customerPhone || null,
          businessId: business.id,
        },
      });
    }

    // 4. Create Sale with PENDING_WEB status + decrement stock
    const sale = await prisma.$transaction(async (tx) => {
      // Decrement stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Create sale
      return tx.sale.create({
        data: {
          total,
          status: 'PENDING_WEB',
          businessId: business.id,
          clientId: client!.id,
          items: {
            create: saleItems,
          },
        },
      });
    });

    return res.status(201).json({ success: true, saleId: sale.id });
  } catch (error: any) {
    console.error('Public checkout error', error);
    if (error?.message?.includes('Insufficient stock')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
