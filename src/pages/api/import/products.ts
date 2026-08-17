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
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    // Map and validate
    const dataToInsert = products.map((p: any) => ({
      businessId,
      name: p.name || 'Producto sin nombre',
      description: p.description || '',
      price: !isNaN(Number(p.price)) ? Number(p.price) : 0,
      stock: !isNaN(Number(p.stock)) ? Number(p.stock) : 0,
      barcode: p.barcode || null,
      imageUrl: p.imageUrl || null,
    }));

    const result = await prisma.product.createMany({
      data: dataToInsert,
      skipDuplicates: true, // Si hay uniqueness constraints
    });

    return res.status(201).json({ success: true, count: result.count });
  } catch (error: any) {
    console.error('Import error', error);
    return res.status(500).json({ error: 'Error importing products' });
  }
}
