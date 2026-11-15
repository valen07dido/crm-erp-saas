import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';
import { requireModule } from '@/lib/server/plan-guard';
import { requireBusinessMembership } from '@/lib/server/auth-guard';
import type { ComboItemInput } from '@/lib/datasource/types';

/**
 * CRUD API for Combo (bundle of products sold at a fixed price) + its items.
 * The tenant (business) is identified via the `x-business-id` header.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;
  if (!(await requireModule(businessId, '/dashboard/offers', res))) return;

  const dataSource = await getDataSource();

  // A combo's items reference product ids from the request body — without
  // this, an admin of this business could point a combo at another
  // business's product id and it would happily link to (and later sell
  // stock from) data that isn't theirs.
  const verifyOwnProducts = async (items: ComboItemInput[]) => {
    if (items.length === 0) return true;
    for (const item of items) {
      const product = await dataSource.products.findById(item.productId);
      if (!product || product.businessId !== businessId) return false;
    }
    return true;
  };

  try {
    switch (req.method) {
      case 'GET': {
        const combos = await dataSource.combos.list(businessId);
        return res.status(200).json(combos);
      }
      case 'POST': {
        const { name, description, price, imageUrl, barcode, isActive, items } = req.body as {
          name: string;
          description?: string;
          price?: number;
          imageUrl?: string;
          barcode?: string;
          isActive?: boolean;
          items: ComboItemInput[];
        };
        if (!name) return res.status(400).json({ error: 'El nombre del combo es obligatorio' });
        if (!Array.isArray(items) || items.reduce((sum, it) => sum + (it.quantity || 0), 0) < 2) {
          return res.status(400).json({ error: 'Un combo necesita al menos 2 unidades en total' });
        }
        if (!(await verifyOwnProducts(items))) {
          return res.status(400).json({ error: 'Uno o más productos no pertenecen a este negocio' });
        }

        const combo = await dataSource.combos.create({
          businessId,
          name,
          description: description || null,
          price: Math.max(0, price ?? 0),
          imageUrl: imageUrl || null,
          barcode: barcode || null,
          isActive: isActive ?? true,
          items,
        });
        return res.status(201).json(combo);
      }
      case 'PUT': {
        const { id } = req.query as { id: string };
        if (!id) return res.status(400).json({ error: 'Combo id is required in query' });

        const { name, description, price, imageUrl, barcode, isActive, items } = req.body as {
          name?: string;
          description?: string;
          price?: number;
          imageUrl?: string;
          barcode?: string;
          isActive?: boolean;
          items?: ComboItemInput[];
        };

        if (items && (!Array.isArray(items) || items.reduce((sum, it) => sum + (it.quantity || 0), 0) < 2)) {
          return res.status(400).json({ error: 'Un combo necesita al menos 2 unidades en total' });
        }
        if (items && !(await verifyOwnProducts(items))) {
          return res.status(400).json({ error: 'Uno o más productos no pertenecen a este negocio' });
        }

        const existingCombo = await dataSource.combos.findById(id);
        if (!existingCombo || existingCombo.businessId !== businessId) {
          return res.status(404).json({ error: 'Combo not found' });
        }

        const combo = await dataSource.combos.update(id, businessId, {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description: description || null }),
          ...(price !== undefined && { price: Math.max(0, price) }),
          ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
          ...(barcode !== undefined && { barcode: barcode || null }),
          ...(isActive !== undefined && { isActive }),
          ...(items && { items }),
        });
        return res.status(200).json(combo);
      }
      case 'DELETE': {
        const { id } = req.query as { id: string };
        if (!id) return res.status(400).json({ error: 'Combo id is required in query' });
        const existingCombo = await dataSource.combos.findById(id);
        if (!existingCombo || existingCombo.businessId !== businessId) {
          return res.status(404).json({ error: 'Combo not found' });
        }
        await dataSource.combos.delete(id, businessId);
        return res.status(204).end();
      }
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Combos API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
