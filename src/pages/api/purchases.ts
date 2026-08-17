import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Missing business ID' });
  }

  if (req.method === 'GET') {
    try {
      const purchases = await prisma.purchase.findMany({
        where: { businessId },
        include: {
          supplier: true,
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(purchases);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching purchases' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { supplierId, items, status } = req.body;
      
      let total = 0;
      
      const purchase = await prisma.$transaction(async (tx) => {
        const newPurchase = await tx.purchase.create({
          data: {
            businessId,
            supplierId,
            status: status || 'COMPLETED',
            total: 0, 
          },
        });

        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product not found: ${item.productId}`);

          // In purchases, price might be the cost price from supplier. We'll use the provided price or default to product price
          const itemPrice = item.price ? Number(item.price) : Number(product.price);
          const itemTotal = itemPrice * item.quantity;
          total += itemTotal;

          await tx.purchaseItem.create({
            data: {
              purchaseId: newPurchase.id,
              productId: item.productId,
              quantity: item.quantity,
              price: itemPrice,
            },
          });

          // Increment stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        const updatedPurchase = await tx.purchase.update({
          where: { id: newPurchase.id },
          data: { total },
          include: {
            supplier: true,
            items: { include: { product: true } },
          },
        });

        // Create financial transaction
        await tx.transaction.create({
          data: {
            businessId,
            type: 'EXPENSE',
            amount: total,
            description: `Compra #${updatedPurchase.id.slice(0, 8)}`,
            category: 'Compras a Proveedores',
          }
        });

        return updatedPurchase;
      });

      return res.status(201).json(purchase);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ error: error.message || 'Error creating purchase' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
