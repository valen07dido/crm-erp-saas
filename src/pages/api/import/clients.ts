import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  try {
    const { clients } = req.body;

    if (!Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ error: 'No clients provided' });
    }

    // Map and validate
    const dataToInsert = clients.map((c: any) => ({
      businessId,
      name: c.name || 'Sin nombre',
      email: c.email || null,
      phone: c.phone || null,
      address: c.address || null,
      documentId: c.documentId || null,
    }));

    const result = await prisma.client.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    return res.status(201).json({ success: true, count: result.count });
  } catch (error: any) {
    console.error('Import error', error);
    return res.status(500).json({ error: 'Error importing clients' });
  }
}
