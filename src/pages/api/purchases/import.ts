import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { supplierId, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay productos para importar' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let productsUpdated = 0;
      let total = 0;
      const purchaseLines: { productId: string; quantity: number; cost: number }[] = [];

      for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        const cost = Number(item.cost) || 0;
        const salePrice = Number(item.salePrice) || 0;

        // A supplier price list has no delivered quantity (quantity 0) — still
        // update the product's catalog price, just without touching stock or
        // logging a purchase/expense for it.
        let product = null;

        if (item.barcode) {
          product = await tx.product.findFirst({
            where: { businessId, barcode: item.barcode },
          });
        }
        if (!product && item.name) {
          product = await tx.product.findFirst({
            where: { businessId, name: { equals: item.name, mode: 'insensitive' } },
          });
        }

        if (product) {
          product = await tx.product.update({
            where: { id: product.id },
            data: { price: salePrice, stock: { increment: quantity } },
          });
        } else {
          product = await tx.product.create({
            data: {
              businessId,
              name: item.name || 'Producto sin nombre',
              barcode: item.barcode || null,
              price: salePrice,
              stock: quantity,
            },
          });
        }
        productsUpdated++;

        if (quantity > 0) {
          purchaseLines.push({ productId: product.id, quantity, cost });
          total += cost * quantity;
        }
      }

      if (purchaseLines.length === 0) {
        return { productsUpdated, purchase: null };
      }

      const newPurchase = await tx.purchase.create({
        data: {
          businessId,
          supplierId: supplierId || null,
          status: 'COMPLETED',
          total: 0,
        },
      });

      for (const line of purchaseLines) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            productId: line.productId,
            quantity: line.quantity,
            price: line.cost,
          },
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

      await tx.transaction.create({
        data: {
          businessId,
          type: 'EXPENSE',
          amount: total,
          description: `Compra #${updatedPurchase.id.slice(0, 8)} (Factura PDF)`,
          category: 'Compras a Proveedores',
        },
      });

      return { productsUpdated, purchase: updatedPurchase };
    });

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Error importing invoice', error);
    return res.status(400).json({ error: error.message || 'Error importando la factura' });
  }
}
