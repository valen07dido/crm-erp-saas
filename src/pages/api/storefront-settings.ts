import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  try {
    if (req.method === 'PUT') {
      const {
        heroTitle,
        heroSubtitle,
        heroImageUrl,
        primaryColor,
        themeMode,
        logoUrl,
        aboutText,
        aboutImageUrl
      } = req.body;

      const storefront = await prisma.storefront.upsert({
        where: { businessId },
        update: {
          heroTitle,
          heroSubtitle,
          heroImageUrl,
          primaryColor,
          themeMode,
          logoUrl,
          aboutText,
          aboutImageUrl
        },
        create: {
          businessId,
          heroTitle,
          heroSubtitle,
          heroImageUrl,
          primaryColor,
          themeMode,
          logoUrl,
          aboutText,
          aboutImageUrl
        }
      });

      return res.status(200).json(storefront);
    } else if (req.method === 'GET') {
      const storefront = await prisma.storefront.findUnique({
        where: { businessId }
      });
      return res.status(200).json(storefront || {});
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Storefront settings API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
