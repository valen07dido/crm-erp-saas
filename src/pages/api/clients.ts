import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Missing business ID' });
  }

  if (req.method === 'GET') {
    try {
      const clients = await prisma.client.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(clients);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching clients' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, email, phone, address } = req.body;
      const client = await prisma.client.create({
        data: { name, email, phone, address, businessId },
      });
      return res.status(201).json(client);
    } catch (error) {
      return res.status(500).json({ error: 'Error creating client' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { name, email, phone, address } = req.body;
      const client = await prisma.client.update({
        where: { id: String(id), businessId },
        data: { name, email, phone, address },
      });
      return res.status(200).json(client);
    } catch (error) {
      return res.status(500).json({ error: 'Error updating client' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await prisma.client.delete({
        where: { id: String(id), businessId },
      });
      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({ error: 'Error deleting client' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
