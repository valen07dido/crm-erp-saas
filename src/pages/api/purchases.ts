import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';
import { requireModule } from '@/lib/server/plan-guard';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Missing business ID' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;
  if (!(await requireModule(businessId, '/dashboard/purchases', res))) return;

  const dataSource = await getDataSource();

  if (req.method === 'GET') {
    try {
      const purchases = await dataSource.purchases.list(businessId);
      return res.status(200).json(purchases);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching purchases' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { supplierId, items, status } = req.body;
      const purchase = await dataSource.purchases.create({ businessId, supplierId: supplierId ?? null, status, items });
      return res.status(201).json(purchase);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ error: error.message || 'Error creating purchase' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
