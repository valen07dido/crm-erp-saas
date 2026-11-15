import { randomUUID } from 'crypto';
import { getDb } from '../connection';
import { decToStr } from '../decimal';
import type { ProductRecord, ProductCreateInput, ProductUpdateInput } from '../../types';

interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: string;
  stock: string;
  image_url: string | null;
  barcode: string | null;
  category: string | null;
  expiration_date: string | null;
  sold_by_weight: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock,
    imageUrl: row.image_url,
    barcode: row.barcode,
    category: row.category,
    expirationDate: row.expiration_date,
    soldByWeight: !!row.sold_by_weight,
    businessId: row.business_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findRowById(id: string): ProductRow | undefined {
  return getDb().prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
}

// Sanitizing (price/stock clamped non-negative, stock rounded unless the
// product is weighable) is the route's job — src/pages/api/products.ts does
// it once, the same way regardless of which datasource ends up storing the
// result, so it isn't duplicated here and in prisma-datasource.ts too.

export const productsRepository = {
  async list(businessId: string): Promise<ProductRecord[]> {
    const rows = getDb()
      .prepare('SELECT * FROM products WHERE business_id = ? ORDER BY created_at DESC')
      .all(businessId) as ProductRow[];
    return rows.map(mapRow);
  },

  async findById(id: string): Promise<ProductRecord | null> {
    const row = findRowById(id);
    return row ? mapRow(row) : null;
  },

  async create(input: ProductCreateInput): Promise<ProductRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO products
          (id, business_id, name, description, price, stock, image_url, barcode, category, expiration_date, sold_by_weight, created_at, updated_at)
         VALUES (@id, @businessId, @name, @description, @price, @stock, @imageUrl, @barcode, @category, @expirationDate, @soldByWeight, @createdAt, @updatedAt)`
      )
      .run({
        id,
        businessId: input.businessId,
        name: input.name,
        description: input.description ?? null,
        price: decToStr(input.price),
        stock: decToStr(input.stock),
        imageUrl: input.imageUrl ?? null,
        barcode: input.barcode ?? null,
        category: input.category ?? null,
        expirationDate: input.expirationDate ?? null,
        soldByWeight: input.soldByWeight ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      });
    return mapRow(findRowById(id)!);
  },

  async update(id: string, input: ProductUpdateInput): Promise<ProductRecord> {
    const existing = findRowById(id);
    if (!existing) throw new Error('Product not found');

    const effectiveSoldByWeight = input.soldByWeight !== undefined ? input.soldByWeight : !!existing.sold_by_weight;
    const next = {
      id,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      price: input.price !== undefined ? decToStr(input.price) : existing.price,
      stock: input.stock !== undefined ? decToStr(input.stock) : existing.stock,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl : existing.image_url,
      barcode: input.barcode !== undefined ? input.barcode : existing.barcode,
      category: input.category !== undefined ? input.category : existing.category,
      expirationDate: input.expirationDate !== undefined ? input.expirationDate : existing.expiration_date,
      soldByWeight: effectiveSoldByWeight ? 1 : 0,
      updatedAt: new Date().toISOString(),
    };

    getDb()
      .prepare(
        `UPDATE products SET name=@name, description=@description, price=@price, stock=@stock,
          image_url=@imageUrl, barcode=@barcode, category=@category, expiration_date=@expirationDate,
          sold_by_weight=@soldByWeight, updated_at=@updatedAt WHERE id=@id`
      )
      .run(next);

    return mapRow(findRowById(id)!);
  },

  async delete(id: string): Promise<void> {
    getDb().prepare('DELETE FROM products WHERE id = ?').run(id);
  },
};
