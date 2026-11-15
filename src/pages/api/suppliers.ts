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
  if (!(await requireModule(businessId, '/dashboard/suppliers', res))) return;

  const dataSource = await getDataSource();

  if (req.method === 'GET') {
    try {
      const suppliers = await dataSource.suppliers.list(businessId);
      return res.status(200).json(suppliers);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching suppliers' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, email, phone, address } = req.body;
      const supplier = await dataSource.suppliers.create(businessId, { name, email, phone, address });
      return res.status(201).json(supplier);
    } catch (error) {
      return res.status(500).json({ error: 'Error creating supplier' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { name, email, phone, address } = req.body;
      const supplier = await dataSource.suppliers.update(String(id), businessId, { name, email, phone, address });
      return res.status(200).json(supplier);
    } catch (error) {
      return res.status(500).json({ error: 'Error updating supplier' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await dataSource.suppliers.delete(String(id), businessId);
      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({ error: 'Error deleting supplier' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
