import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

/**
 * Public endpoint (no auth required) to process orders from the storefront cart.
 * Creates a Sale with status PENDING_WEB so the business owner can see and manage it.
 * Each item is either a product or a combo offer (never both).
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
    items: { productId?: string; comboId?: string; quantity: number }[];
  };

  if (!businessSlug || !customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Find the business
    const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const productItems = items.filter(i => i.productId);
    const comboItems = items.filter(i => i.comboId);

    // 2. Validate products and combos, and compute total
    const products = await prisma.product.findMany({
      where: { id: { in: productItems.map(i => i.productId!) }, businessId: business.id },
    });
    if (products.length !== productItems.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    const combos = await prisma.combo.findMany({
      where: { id: { in: comboItems.map(i => i.comboId!) }, businessId: business.id, isActive: true },
      include: { items: true },
    });
    if (combos.length !== comboItems.length) {
      return res.status(400).json({ error: 'One or more offers not found' });
    }

    let total = 0;
    const saleItemsCreate: Array<{ productId?: string; comboId?: string; quantity: number; price: any }> = [];

    for (const item of productItems) {
      const product = products.find(p => p.id === item.productId)!;
      if (Number(product.stock) < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      total += Number(product.price) * item.quantity;
      saleItemsCreate.push({ productId: product.id, quantity: item.quantity, price: product.price });
    }

    // Also tracks how much of each component product every combo line needs,
    // so stock is checked (and later decremented) across the whole cart at
    // once — two different combos sharing an ingredient must not overcommit it.
    const comboComponentNeeds = new Map<string, number>();
    for (const item of comboItems) {
      const combo = combos.find(c => c.id === item.comboId)!;
      for (const comboItem of combo.items) {
        comboComponentNeeds.set(
          comboItem.productId,
          (comboComponentNeeds.get(comboItem.productId) || 0) + Number(comboItem.quantity) * item.quantity
        );
      }
      total += Number(combo.price) * item.quantity;
      saleItemsCreate.push({ comboId: combo.id, quantity: item.quantity, price: combo.price });
    }

    if (comboComponentNeeds.size > 0) {
      const componentProducts = await prisma.product.findMany({
        where: { id: { in: Array.from(comboComponentNeeds.keys()) } },
      });
      for (const [productId, needed] of comboComponentNeeds) {
        const product = componentProducts.find(p => p.id === productId);
        if (!product || Number(product.stock) < needed) {
          throw new Error(`Insufficient stock for ${product?.name || 'a combo component'}`);
        }
      }
    }

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
      for (const item of productItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      for (const [productId, needed] of comboComponentNeeds) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: needed } },
        });
      }

      return tx.sale.create({
        data: {
          total,
          status: 'PENDING_WEB',
          businessId: business.id,
          clientId: client!.id,
          items: {
            create: saleItemsCreate,
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
