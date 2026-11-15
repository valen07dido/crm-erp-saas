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
      const clients = await dataSource.clients.list(businessId);
      return res.status(200).json(clients);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching clients' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, email, phone, address } = req.body;
      const client = await dataSource.clients.create(businessId, { name, email, phone, address });
      return res.status(201).json(client);
    } catch (error) {
      return res.status(500).json({ error: 'Error creating client' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { name, email, phone, address } = req.body;
      const client = await dataSource.clients.update(String(id), businessId, { name, email, phone, address });
      return res.status(200).json(client);
    } catch (error) {
      return res.status(500).json({ error: 'Error updating client' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await dataSource.clients.delete(String(id), businessId);
      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({ error: 'Error deleting client' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
