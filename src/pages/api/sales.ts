import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Missing business ID' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;

  const dataSource = await getDataSource();

  if (req.method === 'GET') {
    try {
      const sales = await dataSource.sales.list(businessId);
      return res.status(200).json(sales);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching sales' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { clientId, items, status } = req.body;
      const sale = await dataSource.sales.create({ businessId, clientId: clientId ?? null, status, items });
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

      const sale = await dataSource.sales.findById(id);
      if (!sale || sale.businessId !== businessId) {
        return res.status(404).json({ error: 'Sale not found' });
      }

      const updatedSale = await dataSource.sales.updateStatus(id, businessId, status);
      return res.status(200).json(updatedSale);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ error: error.message || 'Error updating sale' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
