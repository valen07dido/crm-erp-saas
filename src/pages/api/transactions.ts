import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Missing business ID' });
  }

  // Filter by type (INCOME or EXPENSE) if provided
  const { type } = req.query;

  if (req.method === 'GET') {
    try {
      const whereClause: any = { businessId };
      if (type && typeof type === 'string') {
        whereClause.type = type;
      }
      
      const transactions = await prisma.transaction.findMany({
        where: whereClause,
        orderBy: { date: 'desc' },
      });
      return res.status(200).json(transactions);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching transactions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { type, amount, description, category, date } = req.body;
      const transaction = await prisma.transaction.create({
        data: {
          businessId,
          type,
          amount: parseFloat(amount),
          description,
          category,
          date: date ? new Date(date) : new Date(),
        },
      });
      return res.status(201).json(transaction);
    } catch (error) {
      return res.status(500).json({ error: 'Error creating transaction' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await prisma.transaction.delete({
        where: { id: String(id), businessId },
      });
      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({ error: 'Error deleting transaction' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
