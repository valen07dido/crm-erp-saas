import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';
import { requireModule } from '@/lib/server/plan-guard';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;
  if (!(await requireModule(businessId, '/dashboard/purchases', res))) return;

  try {
    const { supplierId, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay productos para importar' });
    }

    const dataSource = await getDataSource();
    const result = await dataSource.purchases.bulkImport({ businessId, supplierId: supplierId || null, items });

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Error importing invoice', error);
    return res.status(400).json({ error: error.message || 'Error importando la factura' });
  }
}
