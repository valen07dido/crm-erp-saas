import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;

  try {
    const dataSource = await getDataSource();
    const stats = await dataSource.stats.get(businessId);
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Stats API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
