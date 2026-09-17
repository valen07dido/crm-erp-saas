import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
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

    const result = await prisma.$transaction(
      async (tx) => {
        // Large lists (hundreds/thousands of rows) used to do 2-3 sequential
        // lookups per item inside this transaction, which reliably blew past
        // Prisma's interactive-transaction timeout ("Transaction already
        // closed"). Instead: load the whole catalog once, resolve every item
        // in memory, then apply as a handful of bulk statements.
        const existingProducts = await tx.product.findMany({ where: { businessId } });
        const byBarcode = new Map(
          existingProducts.filter((p) => p.barcode).map((p) => [p.barcode as string, p])
        );
        const byName = new Map(existingProducts.map((p) => [p.name.toLowerCase(), p]));

        const updates = new Map<string, { price: number; stockIncrement: number }>();
        const staged = new Map<
          string,
          { id: string; name: string; barcode: string | null; price: number; stock: number }
        >();
        const purchaseLines: { productId: string; quantity: number; cost: number }[] = [];
        let total = 0;
        let productsUpdated = 0;

        for (const item of items) {
          const quantity = Number(item.quantity) || 0;
          const cost = Number(item.cost) || 0;
          const salePrice = Number(item.salePrice) || 0;
          const name = item.name || 'Producto sin nombre';
          const stageKey = item.barcode || `name:${name.toLowerCase()}`;

          let productId: string;

          const stagedProduct = staged.get(stageKey);
          if (stagedProduct) {
            stagedProduct.price = salePrice;
            stagedProduct.stock += quantity;
            productId = stagedProduct.id;
          } else {
            const existing =
              (item.barcode && byBarcode.get(item.barcode)) || byName.get(name.toLowerCase());
            if (existing) {
              productId = existing.id;
              const u = updates.get(existing.id) || { price: salePrice, stockIncrement: 0 };
              u.price = salePrice;
              u.stockIncrement += quantity;
              updates.set(existing.id, u);
            } else {
              productId = randomUUID();
              staged.set(stageKey, {
                id: productId,
                name,
                barcode: item.barcode || null,
                price: salePrice,
                stock: quantity,
              });
            }
          }
          productsUpdated++;

          if (quantity > 0) {
            purchaseLines.push({ productId, quantity, cost });
            total += cost * quantity;
          }
        }

        if (staged.size > 0) {
          await tx.product.createMany({
            data: Array.from(staged.values()).map((p) => ({
              id: p.id,
              businessId,
              name: p.name,
              barcode: p.barcode,
              price: p.price,
              stock: p.stock,
            })),
          });
        }

        if (updates.size > 0) {
          // One bulk statement instead of one round-trip per row — with
          // thousands of rows, updating them one at a time is what blew the
          // transaction timeout in the first place.
          const values = Array.from(updates.entries()).map(
            ([id, u]) => Prisma.sql`(${id}::text, ${u.price}::decimal, ${u.stockIncrement}::int)`
          );
          await tx.$executeRaw`
            UPDATE "Product" AS p
            SET price = v.price, stock = p.stock + v.stock_increment
            FROM (VALUES ${Prisma.join(values)}) AS v(id, price, stock_increment)
            WHERE p.id = v.id
          `;
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

        await tx.purchaseItem.createMany({
          data: purchaseLines.map((line) => ({
            purchaseId: newPurchase.id,
            productId: line.productId,
            quantity: line.quantity,
            price: line.cost,
          })),
        });

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
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Error importing invoice', error);
    return res.status(400).json({ error: error.message || 'Error importando la factura' });
  }
}
