import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Falta ID de negocio' });
  }

  if (req.method === 'GET') {
    try {
      let storefront = await prisma.storefront.findUnique({
        where: { businessId },
      });

      // If it doesn't exist, create a default one
      if (!storefront) {
        storefront = await prisma.storefront.create({
          data: {
            businessId,
          },
        });
      }

      return res.status(200).json(storefront);
    } catch (error) {
      console.error('Error fetching storefront:', error);
      return res.status(500).json({ error: 'Error al obtener la configuración de la tienda' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { heroTitle, heroSubtitle, heroImageUrl, primaryColor, themeMode } = req.body;

      const updatedStorefront = await prisma.storefront.upsert({
        where: { businessId },
        update: {
          heroTitle,
          heroSubtitle,
          heroImageUrl,
          primaryColor,
          themeMode,
        },
        create: {
          businessId,
          heroTitle,
          heroSubtitle,
          heroImageUrl,
          primaryColor,
          themeMode,
        },
      });

      return res.status(200).json(updatedStorefront);
    } catch (error) {
      console.error('Error updating storefront:', error);
      return res.status(500).json({ error: 'Error al actualizar la configuración de la tienda' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
