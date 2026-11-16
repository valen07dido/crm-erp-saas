import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

/**
 * Simple CRUD API for Product model.
 * The tenant (business) is identified via the `x-business-id` header.
 */

// Price is never negative; stock is never negative, and only a weighable
// product can carry a fractional quantity (kg) — any other product's stock
// is a whole unit count. Sanitized once here, regardless of which datasource
// (Prisma/Postgres or the SQLite repositories) ends up storing the result.
function sanitizeStock(stock: number, soldByWeight: boolean): number {
  const n = Math.max(0, Number(stock) || 0);
  return soldByWeight ? n : Math.round(n);
}
function sanitizePrice(price: number): number {
  return Math.max(0, Number(price) || 0);
}

// Guards against the native <input type="date"> year quirk: typing a
// 2-digit year (e.g. "27" meaning 2027) and tabbing away before completing
// all 4 digits gets zero-padded to a literal year like "0027" instead of
// rejected — silently saving a date ~2000 years off instead of the
// intended one. Any year clearly outside a product's real shelf life is
// rejected rather than stored.
const MIN_EXPIRATION_YEAR = 2000;
const MAX_EXPIRATION_YEAR = new Date().getFullYear() + 50;
function isValidExpirationDate(value: string): boolean {
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) && year >= MIN_EXPIRATION_YEAR && year <= MAX_EXPIRATION_YEAR;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;

  const dataSource = await getDataSource();

  try {
    switch (req.method) {
      case 'GET': {
        const products = await dataSource.products.list(businessId);
        return res.status(200).json(products);
      }
      case 'POST': {
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
        if (expirationDate && !isValidExpirationDate(expirationDate)) {
          return res.status(400).json({ error: `Fecha de vencimiento inválida: el año debe estar entre ${MIN_EXPIRATION_YEAR} y ${MAX_EXPIRATION_YEAR}` });
        }
        const product = await dataSource.products.create({
          businessId,
          name,
          description: description ?? null,
          price: sanitizePrice(price ?? 0),
          stock: sanitizeStock(stock ?? 0, soldByWeight ?? false),
          imageUrl: imageUrl || null,
          barcode: barcode || null,
          category: category || null,
          expirationDate: expirationDate || null,
          soldByWeight: soldByWeight ?? false,
        });
        return res.status(201).json(product);
      }
      case 'PUT': {
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
        if (expirationDate && !isValidExpirationDate(expirationDate)) {
          return res.status(400).json({ error: `Fecha de vencimiento inválida: el año debe estar entre ${MIN_EXPIRATION_YEAR} y ${MAX_EXPIRATION_YEAR}` });
        }
        // id alone isn't enough to scope this write — it's a bare UUID with
        // no tenant check, so without `businessId` here too, knowing/leaking
        // any product id would let you edit a DIFFERENT business's product.
        const existing = await dataSource.products.findById(id);
        if (!existing || existing.businessId !== businessId) {
          return res.status(404).json({ error: 'Product not found' });
        }
        const effectiveSoldByWeight = soldByWeight !== undefined ? soldByWeight : existing.soldByWeight;
        const product = await dataSource.products.update(id, {
          ...rest,
          ...(soldByWeight !== undefined && { soldByWeight }),
          ...(price !== undefined && { price: sanitizePrice(price) }),
          ...(stock !== undefined && { stock: sanitizeStock(stock, effectiveSoldByWeight ?? false) }),
          ...(expirationDate !== undefined && { expirationDate: expirationDate || null }),
        });
        return res.status(200).json(product);
      }
      case 'DELETE': {
        const { id } = req.query as { id: string };
        if (!id) {
          return res.status(400).json({ error: 'Product id is required in query' });
        }
        const existing = await dataSource.products.findById(id);
        if (!existing || existing.businessId !== businessId) {
          return res.status(404).json({ error: 'Product not found' });
        }
        await dataSource.products.delete(id);
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
