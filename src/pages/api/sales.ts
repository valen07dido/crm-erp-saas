import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Missing business ID' });
  }

  if (req.method === 'GET') {
    try {
      const sales = await prisma.sale.findMany({
        where: { businessId },
        include: {
          client: true,
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(sales);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching sales' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { clientId, items, status } = req.body;
      
      // Calculate total and prepare transaction operations
      let total = 0;
      
      // Start a Prisma transaction to ensure atomicity
      const sale = await prisma.$transaction(async (tx) => {
        // Create the sale record
        const newSale = await tx.sale.create({
          data: {
            businessId,
            clientId,
            status: status || 'COMPLETED',
            total: 0, // Will update this
          },
        });

        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product not found: ${item.productId}`);
          if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

          const itemTotal = Number(product.price) * item.quantity;
          total += itemTotal;

          await tx.saleItem.create({
            data: {
              saleId: newSale.id,
              productId: item.productId,
              quantity: item.quantity,
              price: product.price,
            },
          });

          // Decrement stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        // Update total
        const updatedSale = await tx.sale.update({
          where: { id: newSale.id },
          data: { total },
          include: {
            client: true,
            items: { include: { product: true } },
          },
        });

        // Create financial transaction
        await tx.transaction.create({
          data: {
            businessId,
            type: 'INCOME',
            amount: total,
            description: `Venta #${updatedSale.id.slice(0, 8)}`,
            category: 'Ventas',
          }
        });

        return updatedSale;
      });

      return res.status(201).json(sale);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ error: error.message || 'Error creating sale' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, status } = req.body;
      if (!id || !status) return res.status(400).json({ error: 'Missing fields' });

      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!sale || sale.businessId !== businessId) {
        return res.status(404).json({ error: 'Sale not found' });
      }

      if (sale.status === status) {
        return res.status(200).json(sale);
      }

      const updatedSale = await prisma.$transaction(async (tx) => {
        // If moving to COMPLETED from PENDING_WEB, we need to register the INCOME transaction
        // (Stock was already decremented during PENDING_WEB creation)
        if (sale.status === 'PENDING_WEB' && status === 'COMPLETED') {
          await tx.transaction.create({
            data: {
              businessId,
              type: 'INCOME',
              amount: sale.total,
              description: `Venta Web #${sale.id.slice(0, 8)} Completada`,
              category: 'Ventas',
            }
          });
        }

        // If CANCELLED, restore stock
        if (status === 'CANCELLED' && sale.status !== 'CANCELLED') {
          for (const item of sale.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
          // If we had already created a transaction for this, we should ideally reverse it,
          // but for now PENDING_WEB doesn't have a transaction yet, so we just restore stock.
        }

        return tx.sale.update({
          where: { id },
          data: { status },
          include: {
            client: true,
            items: { include: { product: true } },
          },
        });
      });

      return res.status(200).json(updatedSale);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ error: error.message || 'Error updating sale' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
