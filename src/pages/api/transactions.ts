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
  // Backs both Caja and Gastos — same plan tier, so either module path works.
  if (!(await requireModule(businessId, '/dashboard/cash-register', res))) return;

  const dataSource = await getDataSource();
  const { type } = req.query;

  if (req.method === 'GET') {
    try {
      const transactions = await dataSource.transactions.list(businessId, typeof type === 'string' ? type : undefined);
      return res.status(200).json(transactions);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching transactions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { type, amount, description, category, date } = req.body;
      const transaction = await dataSource.transactions.create({
        businessId,
        type,
        amount: parseFloat(amount),
        description,
        category,
        date,
      });
      return res.status(201).json(transaction);
    } catch (error) {
      return res.status(500).json({ error: 'Error creating transaction' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await dataSource.transactions.delete(String(id), businessId);
      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({ error: 'Error deleting transaction' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
