import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import type {
  DataSource,
  ProductRecord,
  ClientRecord,
  ComboRecord,
  SupplierRecord,
  PurchaseRecord,
  PurchaseItemRecord,
  SaleRecord,
  SaleItemRecord,
  TransactionRecord,
  BusinessSettingsRecord,
  BusinessUserRecord,
} from './types';

function mapProduct(p: any): ProductRecord {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price.toString(),
    stock: p.stock.toString(),
    imageUrl: p.imageUrl,
    barcode: p.barcode,
    category: p.category,
    expirationDate: p.expirationDate ? new Date(p.expirationDate).toISOString() : null,
    soldByWeight: p.soldByWeight,
    businessId: p.businessId,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
  };
}

function mapClient(c: any): ClientRecord {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    businessId: c.businessId,
    createdAt: new Date(c.createdAt).toISOString(),
    updatedAt: new Date(c.updatedAt).toISOString(),
  };
}

function mapBusinessUser(bu: any): BusinessUserRecord {
  return {
    id: bu.id,
    userId: bu.userId,
    businessId: bu.businessId,
    role: bu.role,
    createdAt: new Date(bu.createdAt).toISOString(),
    updatedAt: new Date(bu.updatedAt).toISOString(),
    user: { id: bu.user.id, email: bu.user.email, username: bu.user.username, name: bu.user.name },
  };
}

const BUSINESS_USER_INCLUDE = {
  user: { select: { id: true, email: true, username: true, name: true } },
} as const;

function mapBusinessSettings(s: any): BusinessSettingsRecord {
  return {
    id: s.id,
    businessId: s.businessId,
    currency: s.currency,
    taxRate: Number(s.taxRate),
    shiftMorningStartHour: s.shiftMorningStartHour,
    shiftMorningEndHour: s.shiftMorningEndHour,
    shiftNightStartHour: s.shiftNightStartHour,
    shiftNightEndHour: s.shiftNightEndHour,
    shiftMorningLabel: s.shiftMorningLabel,
    shiftNightLabel: s.shiftNightLabel,
    ticketWidthMm: s.ticketWidthMm,
    printTicketOnSale: s.printTicketOnSale,
    printLeftOffsetMm: Number(s.printLeftOffsetMm),
  };
}

function mapSupplier(s: any): SupplierRecord {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    address: s.address,
    businessId: s.businessId,
    createdAt: new Date(s.createdAt).toISOString(),
    updatedAt: new Date(s.updatedAt).toISOString(),
  };
}

function mapPurchaseItem(i: any): PurchaseItemRecord {
  return {
    id: i.id,
    purchaseId: i.purchaseId,
    productId: i.productId,
    quantity: i.quantity.toString(),
    price: i.price.toString(),
    product: i.product ? { id: i.product.id, name: i.product.name } : null,
  };
}

function mapPurchase(p: any): PurchaseRecord {
  return {
    id: p.id,
    businessId: p.businessId,
    supplierId: p.supplierId,
    status: p.status,
    total: p.total.toString(),
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
    supplier: p.supplier ? mapSupplier(p.supplier) : null,
    items: (p.items || []).map(mapPurchaseItem),
  };
}

const PURCHASE_INCLUDE = {
  supplier: true,
  items: { include: { product: true } },
} as const;

function mapComboItem(it: any): ComboRecord['items'][number] {
  return {
    id: it.id,
    productId: it.productId,
    quantity: Number(it.quantity),
    product: { id: it.product.id, name: it.product.name },
  };
}

function mapCombo(c: any): ComboRecord {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    price: c.price.toString(),
    imageUrl: c.imageUrl,
    barcode: c.barcode,
    isActive: c.isActive,
    businessId: c.businessId,
    createdAt: new Date(c.createdAt).toISOString(),
    updatedAt: new Date(c.updatedAt).toISOString(),
    items: (c.items || []).map(mapComboItem),
  };
}

function mapSaleItem(i: any): SaleItemRecord {
  return {
    id: i.id,
    saleId: i.saleId,
    productId: i.productId,
    comboId: i.comboId,
    quantity: i.quantity.toString(),
    price: i.price.toString(),
    product: i.product ? { id: i.product.id, name: i.product.name } : null,
    combo: i.combo ? { id: i.combo.id, name: i.combo.name } : null,
  };
}

function mapSale(s: any): SaleRecord {
  return {
    id: s.id,
    businessId: s.businessId,
    clientId: s.clientId,
    status: s.status,
    total: s.total.toString(),
    createdAt: new Date(s.createdAt).toISOString(),
    updatedAt: new Date(s.updatedAt).toISOString(),
    items: (s.items || []).map(mapSaleItem),
    client: s.client ? mapClient(s.client) : null,
  };
}

function mapTransaction(t: any): TransactionRecord {
  return {
    id: t.id,
    businessId: t.businessId,
    type: t.type,
    amount: t.amount.toString(),
    description: t.description,
    category: t.category,
    date: new Date(t.date).toISOString(),
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  };
}

const SALE_INCLUDE = {
  client: true,
  items: { include: { product: true, combo: true } },
} as const;

export const prismaDataSource: DataSource = {
  products: {
    async list(businessId) {
      const rows = await prisma.product.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
      return rows.map(mapProduct);
    },
    async findById(id) {
      const row = await prisma.product.findUnique({ where: { id } });
      return row ? mapProduct(row) : null;
    },
    async create(input) {
      const row = await prisma.product.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          price: input.price,
          stock: input.stock,
          imageUrl: input.imageUrl ?? null,
          barcode: input.barcode ?? null,
          category: input.category ?? null,
          expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
          soldByWeight: input.soldByWeight,
          business: { connect: { id: input.businessId } },
        },
      });
      return mapProduct(row);
    },
    async update(id, input) {
      const { expirationDate, ...rest } = input;
      const row = await prisma.product.update({
        where: { id },
        data: {
          ...rest,
          ...(expirationDate !== undefined && { expirationDate: expirationDate ? new Date(expirationDate) : null }),
        },
      });
      return mapProduct(row);
    },
    async delete(id) {
      await prisma.product.delete({ where: { id } });
    },
  },

  clients: {
    async list(businessId) {
      const rows = await prisma.client.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
      return rows.map(mapClient);
    },
    async create(businessId, input) {
      const row = await prisma.client.create({ data: { ...input, businessId } });
      return mapClient(row);
    },
    async update(id, businessId, input) {
      const row = await prisma.client.update({ where: { id, businessId }, data: input });
      return mapClient(row);
    },
    async delete(id, businessId) {
      await prisma.client.delete({ where: { id, businessId } });
    },
  },

  suppliers: {
    async list(businessId) {
      const rows = await prisma.supplier.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
      return rows.map(mapSupplier);
    },
    async create(businessId, input) {
      const row = await prisma.supplier.create({ data: { ...input, businessId } });
      return mapSupplier(row);
    },
    async update(id, businessId, input) {
      const row = await prisma.supplier.update({ where: { id, businessId }, data: input });
      return mapSupplier(row);
    },
    async delete(id, businessId) {
      await prisma.supplier.delete({ where: { id, businessId } });
    },
  },

  purchases: {
    async list(businessId) {
      const rows = await prisma.purchase.findMany({ where: { businessId }, include: PURCHASE_INCLUDE, orderBy: { createdAt: 'desc' } });
      return rows.map(mapPurchase);
    },
    async create(input) {
      const { businessId, supplierId, status, items } = input;

      if (supplierId) {
        const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
        if (!supplier) throw new Error('Proveedor no encontrado');
      }

      let total = 0;

      const purchase = await prisma.$transaction(async (tx) => {
        const newPurchase = await tx.purchase.create({
          data: { businessId, supplierId: supplierId ?? null, status: status || 'COMPLETED', total: 0 },
        });

        for (const item of items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, businessId } });
          if (!product) throw new Error(`Product not found: ${item.productId}`);

          const itemPrice = item.price !== undefined ? Number(item.price) : Number(product.price);
          const itemTotal = itemPrice * item.quantity;
          total += itemTotal;

          await tx.purchaseItem.create({
            data: { purchaseId: newPurchase.id, productId: item.productId, quantity: item.quantity, price: itemPrice },
          });

          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }

        const updatedPurchase = await tx.purchase.update({
          where: { id: newPurchase.id },
          data: { total },
          include: PURCHASE_INCLUDE,
        });

        await tx.transaction.create({
          data: {
            businessId,
            type: 'EXPENSE',
            amount: total,
            description: `Compra #${updatedPurchase.id.slice(0, 8)}`,
            category: 'Compras a Proveedores',
          },
        });

        return updatedPurchase;
      });

      return mapPurchase(purchase);
    },
    async bulkImport(input) {
      const { businessId, supplierId, items } = input;

      const result = await prisma.$transaction(
        async (tx) => {
          const existingProducts = await tx.product.findMany({ where: { businessId } });
          const byBarcode = new Map(existingProducts.filter((p) => p.barcode).map((p) => [p.barcode as string, p]));
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
              const existing = (item.barcode && byBarcode.get(item.barcode)) || byName.get(name.toLowerCase());
              if (existing) {
                productId = existing.id;
                const u = updates.get(existing.id) || { price: salePrice, stockIncrement: 0 };
                u.price = salePrice;
                u.stockIncrement += quantity;
                updates.set(existing.id, u);
              } else {
                productId = randomUUID();
                staged.set(stageKey, { id: productId, name, barcode: item.barcode || null, price: salePrice, stock: quantity });
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
            data: { businessId, supplierId: supplierId || null, status: 'COMPLETED', total: 0 },
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
            include: PURCHASE_INCLUDE,
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

      return { productsUpdated: result.productsUpdated, purchase: result.purchase ? mapPurchase(result.purchase) : null };
    },
  },

  combos: {
    async list(businessId) {
      const rows = await prisma.combo.findMany({
        where: { businessId },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapCombo);
    },
    async findById(id) {
      const row = await prisma.combo.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
      return row ? mapCombo(row) : null;
    },
    async create(input) {
      const row = await prisma.combo.create({
        data: {
          name: input.name,
          description: input.description || null,
          price: Math.max(0, input.price ?? 0),
          imageUrl: input.imageUrl || null,
          barcode: input.barcode || null,
          isActive: input.isActive ?? true,
          business: { connect: { id: input.businessId } },
          items: { create: input.items.map((it) => ({ productId: it.productId, quantity: it.quantity })) },
        },
        include: { items: { include: { product: true } } },
      });
      return mapCombo(row);
    },
    async update(id, businessId, input) {
      const existing = await prisma.combo.findUnique({ where: { id }, select: { businessId: true } });
      if (!existing || existing.businessId !== businessId) throw new Error('Combo not found');

      const row = await prisma.$transaction(async (tx) => {
        if (input.items) {
          await tx.comboItem.deleteMany({ where: { comboId: id } });
        }
        return tx.combo.update({
          where: { id },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description || null }),
            ...(input.price !== undefined && { price: Math.max(0, input.price) }),
            ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl || null }),
            ...(input.barcode !== undefined && { barcode: input.barcode || null }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
            ...(input.items && {
              items: { create: input.items.map((it) => ({ productId: it.productId, quantity: it.quantity })) },
            }),
          },
          include: { items: { include: { product: true } } },
        });
      });
      return mapCombo(row);
    },
    async delete(id, businessId) {
      const existing = await prisma.combo.findUnique({ where: { id }, select: { businessId: true } });
      if (!existing || existing.businessId !== businessId) throw new Error('Combo not found');
      await prisma.combo.delete({ where: { id } });
    },
  },

  sales: {
    async list(businessId) {
      const rows = await prisma.sale.findMany({ where: { businessId }, include: SALE_INCLUDE, orderBy: { createdAt: 'desc' } });
      return rows.map(mapSale);
    },
    async findById(id) {
      const row = await prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
      return row ? mapSale(row) : null;
    },
    async create(input) {
      const { businessId, clientId, status, items } = input;
      let total = 0;

      const sale = await prisma.$transaction(async (tx) => {
        const newSale = await tx.sale.create({
          data: { businessId, clientId: clientId ?? null, status: status || 'COMPLETED', total: 0 },
        });

        for (const item of items) {
          if (item.comboId) {
            const combo = await tx.combo.findFirst({ where: { id: item.comboId, businessId }, include: { items: true } });
            if (!combo) throw new Error(`Combo not found: ${item.comboId}`);

            for (const comboItem of combo.items) {
              const product = await tx.product.findUnique({ where: { id: comboItem.productId } });
              if (!product) throw new Error(`Product not found: ${comboItem.productId}`);
              const needed = Number(comboItem.quantity) * item.quantity;
              if (Number(product.stock) < needed) throw new Error(`Stock insuficiente de ${product.name} para el combo ${combo.name}`);
            }

            const itemTotal = Number(combo.price) * item.quantity;
            total += itemTotal;

            await tx.saleItem.create({
              data: { saleId: newSale.id, comboId: item.comboId, quantity: item.quantity, price: combo.price },
            });

            for (const comboItem of combo.items) {
              await tx.product.update({
                where: { id: comboItem.productId },
                data: { stock: { decrement: Number(comboItem.quantity) * item.quantity } },
              });
            }
            continue;
          }

          const product = await tx.product.findFirst({ where: { id: item.productId, businessId } });
          if (!product) throw new Error(`Product not found: ${item.productId}`);
          if (Number(product.stock) < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

          const itemTotal = Number(product.price) * item.quantity;
          total += itemTotal;

          await tx.saleItem.create({
            data: { saleId: newSale.id, productId: item.productId, quantity: item.quantity, price: product.price },
          });

          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        }

        const updatedSale = await tx.sale.update({ where: { id: newSale.id }, data: { total }, include: SALE_INCLUDE });

        await tx.transaction.create({
          data: {
            businessId,
            type: 'INCOME',
            amount: total,
            description: `Venta #${updatedSale.id.slice(0, 8)}`,
            category: 'Ventas',
          },
        });

        return updatedSale;
      });

      return mapSale(sale);
    },
    async updateStatus(id, businessId, status) {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { items: { include: { combo: { include: { items: true } } } } },
      });
      if (!sale || sale.businessId !== businessId) throw new Error('Sale not found');
      if (sale.status === status) {
        const current = await prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
        return mapSale(current);
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (sale.status === 'PENDING_WEB' && status === 'COMPLETED') {
          await tx.transaction.create({
            data: {
              businessId,
              type: 'INCOME',
              amount: sale.total,
              description: `Venta Web #${sale.id.slice(0, 8)} Completada`,
              category: 'Ventas',
            },
          });
        }

        if (status === 'CANCELLED' && sale.status !== 'CANCELLED') {
          for (const item of sale.items) {
            if (item.combo) {
              for (const comboItem of item.combo.items) {
                await tx.product.update({
                  where: { id: comboItem.productId },
                  data: { stock: { increment: Number(comboItem.quantity) * Number(item.quantity) } },
                });
              }
              continue;
            }
            if (!item.productId) continue;
            await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          }
          // If we had already created a transaction for this, we should ideally reverse it,
          // but for now PENDING_WEB doesn't have a transaction yet, so we just restore stock.
          // (Preserved as-is from the original behavior — the `Transaction` model has no
          // `saleId` back-reference to do this safely here; see the SQLite repository,
          // which has a real sale_id column, for the fixed version used by WALTI Desktop.)
        }

        return tx.sale.update({ where: { id }, data: { status }, include: SALE_INCLUDE });
      });

      return mapSale(updated);
    },
  },

  transactions: {
    async list(businessId, type) {
      const rows = await prisma.transaction.findMany({
        where: { businessId, ...(type ? { type } : {}) },
        orderBy: { date: 'desc' },
      });
      return rows.map(mapTransaction);
    },
    async create(input) {
      const row = await prisma.transaction.create({
        data: {
          businessId: input.businessId,
          type: input.type,
          amount: input.amount,
          description: input.description,
          category: input.category ?? null,
          date: input.date ? new Date(input.date) : new Date(),
        },
      });
      return mapTransaction(row);
    },
    async delete(id, businessId) {
      await prisma.transaction.delete({ where: { id, businessId } });
    },
  },

  businessSettings: {
    async get(businessId) {
      const row = await prisma.businessSettings.upsert({ where: { businessId }, update: {}, create: { businessId } });
      return mapBusinessSettings(row);
    },
    async update(businessId, input) {
      const clampHour = (h: number) => Math.min(23, Math.max(0, h));
      const clampTaxRate = (t: number) => Math.min(100, Math.max(0, t));
      const {
        currency,
        taxRate,
        shiftMorningStartHour,
        shiftMorningEndHour,
        shiftNightStartHour,
        shiftNightEndHour,
        shiftMorningLabel,
        shiftNightLabel,
        ticketWidthMm,
        printTicketOnSale,
        printLeftOffsetMm,
      } = input;
      const clampOffset = (v: number) => Math.min(30, Math.max(0, v));
      const row = await prisma.businessSettings.upsert({
        where: { businessId },
        update: {
          ...(currency !== undefined && { currency }),
          ...(taxRate !== undefined && { taxRate: clampTaxRate(taxRate) }),
          ...(shiftMorningStartHour !== undefined && { shiftMorningStartHour: clampHour(shiftMorningStartHour) }),
          ...(shiftMorningEndHour !== undefined && { shiftMorningEndHour: clampHour(shiftMorningEndHour) }),
          ...(shiftNightStartHour !== undefined && { shiftNightStartHour: clampHour(shiftNightStartHour) }),
          ...(shiftNightEndHour !== undefined && { shiftNightEndHour: clampHour(shiftNightEndHour) }),
          ...(shiftMorningLabel !== undefined && { shiftMorningLabel }),
          ...(shiftNightLabel !== undefined && { shiftNightLabel }),
          ...(ticketWidthMm !== undefined && { ticketWidthMm: Math.min(300, Math.max(30, ticketWidthMm)) }),
          ...(printTicketOnSale !== undefined && { printTicketOnSale }),
          ...(printLeftOffsetMm !== undefined && { printLeftOffsetMm: clampOffset(printLeftOffsetMm) }),
        },
        create: {
          businessId,
          currency: currency ?? 'USD',
          taxRate: taxRate !== undefined ? clampTaxRate(taxRate) : 0,
          shiftMorningStartHour: shiftMorningStartHour !== undefined ? clampHour(shiftMorningStartHour) : 8,
          shiftMorningEndHour: shiftMorningEndHour !== undefined ? clampHour(shiftMorningEndHour) : 12,
          shiftNightStartHour: shiftNightStartHour !== undefined ? clampHour(shiftNightStartHour) : 16,
          shiftNightEndHour: shiftNightEndHour !== undefined ? clampHour(shiftNightEndHour) : 21,
          shiftMorningLabel: shiftMorningLabel ?? 'Turno Mañana',
          shiftNightLabel: shiftNightLabel ?? 'Turno Noche',
          ticketWidthMm: ticketWidthMm ?? 58,
          printTicketOnSale: printTicketOnSale ?? false,
          printLeftOffsetMm: printLeftOffsetMm !== undefined ? clampOffset(printLeftOffsetMm) : 0,
        },
      });
      return mapBusinessSettings(row);
    },
  },

  stats: {
    async get(businessId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const SERIES_DAYS = 14;
      const seriesStart = new Date(today);
      seriesStart.setDate(seriesStart.getDate() - (SERIES_DAYS - 1));

      const notCancelled = { status: { not: 'CANCELLED' } } as const;

      const [
        salesTodayAgg,
        salesYesterdayAgg,
        salesMonthAgg,
        salesLastMonthAgg,
        productsAgg,
        clientsAgg,
        recentSales,
        lowStockProducts,
        seriesSales,
        monthSaleItems,
        monthClientSales,
      ] = await Promise.all([
        prisma.sale.aggregate({ _sum: { total: true }, where: { businessId, createdAt: { gte: today }, ...notCancelled } }),
        prisma.sale.aggregate({
          _sum: { total: true },
          where: { businessId, createdAt: { gte: yesterday, lt: today }, ...notCancelled },
        }),
        prisma.sale.aggregate({ _sum: { total: true }, where: { businessId, createdAt: { gte: firstDayOfMonth }, ...notCancelled } }),
        prisma.sale.aggregate({
          _sum: { total: true },
          where: { businessId, createdAt: { gte: firstDayOfLastMonth, lt: firstDayOfMonth }, ...notCancelled },
        }),
        prisma.product.aggregate({ _count: { id: true }, where: { businessId, stock: { gt: 0 } } }),
        prisma.client.aggregate({ _count: { id: true }, where: { businessId } }),
        prisma.sale.findMany({
          where: { businessId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { client: { select: { name: true } } },
        }),
        prisma.product.findMany({ where: { businessId, stock: { lte: 5 } }, orderBy: { stock: 'asc' }, take: 10 }),
        prisma.sale.findMany({
          where: { businessId, createdAt: { gte: seriesStart }, ...notCancelled },
          select: { total: true, createdAt: true },
        }),
        prisma.saleItem.findMany({
          where: { sale: { businessId, createdAt: { gte: firstDayOfMonth }, ...notCancelled }, productId: { not: null } },
          select: { quantity: true, price: true, product: { select: { id: true, name: true, category: true } } },
        }),
        prisma.sale.findMany({
          where: { businessId, createdAt: { gte: firstDayOfMonth }, clientId: { not: null }, ...notCancelled },
          select: { total: true, client: { select: { id: true, name: true } } },
        }),
      ]);

      const salesTodayTotal = salesTodayAgg._sum.total ? Number(salesTodayAgg._sum.total) : 0;
      const salesYesterdayTotal = salesYesterdayAgg._sum.total ? Number(salesYesterdayAgg._sum.total) : 0;
      const salesMonthTotal = salesMonthAgg._sum.total ? Number(salesMonthAgg._sum.total) : 0;
      const salesLastMonthTotal = salesLastMonthAgg._sum.total ? Number(salesLastMonthAgg._sum.total) : 0;

      const seriesMap = new Map<string, number>();
      for (let i = 0; i < SERIES_DAYS; i++) {
        const d = new Date(seriesStart);
        d.setDate(d.getDate() + i);
        seriesMap.set(d.toISOString().slice(0, 10), 0);
      }
      for (const sale of seriesSales) {
        const key = sale.createdAt.toISOString().slice(0, 10);
        seriesMap.set(key, (seriesMap.get(key) ?? 0) + Number(sale.total));
      }
      const salesSeries = Array.from(seriesMap, ([date, total]) => ({ date, total }));

      const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
      const categoryTotals = new Map<string, number>();
      for (const item of monthSaleItems) {
        if (!item.product) continue;
        const revenue = Number(item.price) * Number(item.quantity);
        const existing = productTotals.get(item.product.id);
        if (existing) {
          existing.quantity += Number(item.quantity);
          existing.revenue += revenue;
        } else {
          productTotals.set(item.product.id, { name: item.product.name, quantity: Number(item.quantity), revenue });
        }
        const cat = item.product.category || 'Sin categoría';
        categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + revenue);
      }
      const topProducts = Array.from(productTotals, ([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      const salesByCategory = Array.from(categoryTotals, ([category, revenue]) => ({ category, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);

      const clientTotals = new Map<string, { name: string; total: number }>();
      for (const sale of monthClientSales) {
        if (!sale.client) continue;
        const existing = clientTotals.get(sale.client.id);
        if (existing) {
          existing.total += Number(sale.total);
        } else {
          clientTotals.set(sale.client.id, { name: sale.client.name, total: Number(sale.total) });
        }
      }
      const topClients = Array.from(clientTotals, ([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return {
        salesToday: salesTodayTotal,
        salesYesterday: salesYesterdayTotal,
        salesMonth: salesMonthTotal,
        salesLastMonth: salesLastMonthTotal,
        productsInStock: productsAgg._count.id,
        totalClients: clientsAgg._count.id,
        recentSales: recentSales.map((sale) => ({
          id: sale.id,
          total: Number(sale.total),
          status: sale.status,
          createdAt: sale.createdAt.toISOString(),
          clientName: sale.client?.name || 'Consumidor Final',
        })),
        lowStockProducts: lowStockProducts.map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock) })),
        salesSeries,
        topProducts,
        salesByCategory,
        topClients,
      };
    },
  },

  reports: {
    async getAdvanced(businessId) {
      const topProductsRaw = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { businessId, status: { not: 'CANCELLED' } }, productId: { not: null } },
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      });

      const topProducts = await Promise.all(
        topProductsRaw.map(async (tp) => {
          const p = tp.productId ? await prisma.product.findUnique({ where: { id: tp.productId } }) : null;
          return {
            id: p?.id,
            name: p?.name || 'Desconocido',
            quantity: Number(tp._sum.quantity || 0),
            revenue: Number(tp._sum.quantity || 0) * Number(tp._sum.price || 0),
          };
        })
      );

      const topClientsRaw = await prisma.sale.groupBy({
        by: ['clientId'],
        where: { businessId, status: { not: 'CANCELLED' }, clientId: { not: null } },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      });

      const topClients = await Promise.all(
        topClientsRaw.map(async (tc) => {
          const c = await prisma.client.findUnique({ where: { id: tc.clientId! } });
          return { id: c?.id, name: c?.name || 'Desconocido', purchases: tc._count.id, spent: Number(tc._sum.total || 0) };
        })
      );

      return { topProducts, topClients };
    },
  },

  businessUsers: {
    async list(businessId) {
      const rows = await prisma.businessUser.findMany({
        where: { businessId },
        include: BUSINESS_USER_INCLUDE,
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(mapBusinessUser);
    },
    async findById(id) {
      const row = await prisma.businessUser.findUnique({ where: { id }, include: BUSINESS_USER_INCLUDE });
      return row ? mapBusinessUser(row) : null;
    },
    async findConflict(email, username) {
      const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
      if (!existing) return null;
      return existing.email === email ? 'email' : 'username';
    },
    async create(input) {
      // This business's own placeholder Role row (created at signup) — reused
      // as the FK target; actual access is gated by BusinessUser.role (string).
      let placeholderRole = await prisma.role.findFirst({ where: { businessId: input.businessId } });
      if (!placeholderRole) {
        placeholderRole = await prisma.role.create({ data: { name: `staff-${input.businessId}`, businessId: input.businessId } });
      }

      const businessUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            username: input.username,
            name: input.name || null,
            passwordHash: bcrypt.hashSync(input.password, 10),
          },
        });
        return tx.businessUser.create({
          data: { userId: user.id, businessId: input.businessId, roleId: placeholderRole!.id, role: input.role },
          include: BUSINESS_USER_INCLUDE,
        });
      });

      return mapBusinessUser(businessUser);
    },
    async update(id, businessId, input) {
      const target = await prisma.businessUser.findUnique({ where: { id } });
      if (!target || target.businessId !== businessId) throw new Error('Usuario no encontrado en este negocio');

      const updated = await prisma.businessUser.update({
        where: { id },
        data: input.role !== undefined ? { role: input.role } : {},
        include: BUSINESS_USER_INCLUDE,
      });

      if (input.password) {
        await prisma.user.update({ where: { id: target.userId }, data: { passwordHash: bcrypt.hashSync(input.password, 10) } });
      }

      return mapBusinessUser(updated);
    },
    async delete(id, businessId) {
      const target = await prisma.businessUser.findUnique({ where: { id } });
      if (!target || target.businessId !== businessId) throw new Error('Usuario no encontrado en este negocio');
      await prisma.businessUser.delete({ where: { id } });
    },
  },

  auth: {
    async findUserByIdentifier(identifier) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { username: identifier }] },
      });
      if (!user) return null;
      return { id: user.id, email: user.email, username: user.username, name: user.name, passwordHash: user.passwordHash };
    },
  },

  membership: {
    async find(userId, businessId) {
      const m = await prisma.businessUser.findFirst({ where: { userId, businessId } });
      return m ? { userId: m.userId, businessId: m.businessId, role: m.role } : null;
    },
    async findForUser(userId) {
      const m = await prisma.businessUser.findFirst({ where: { userId }, include: { business: true } });
      if (!m) return null;
      return {
        role: m.role,
        business: {
          id: m.business.id,
          name: m.business.name,
          slug: m.business.slug,
          logoUrl: m.business.logoUrl,
          isActive: m.business.isActive,
          planName: m.business.planName,
          planExpiresAt: m.business.planExpiresAt ? new Date(m.business.planExpiresAt).toISOString() : null,
        },
      };
    },
  },

  setup: {
    // The SaaS web product has its own signup/superadmin onboarding — this
    // bootstrap flow is desktop-only and should never be reached here.
    async needsInitialSetup() {
      return false;
    },
    async createInitialAdmin() {
      throw new Error('createInitialAdmin is only available in WALTI Desktop');
    },
  },
};
