import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireModule } from '@/lib/server/plan-guard';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    return res.status(401).json({ error: 'Falta ID de negocio' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;
  // Tienda Online (the storefront editor that calls this endpoint) is an
  // Enterprise-only module — enforce it here too, not just in the sidebar.
  if (!(await requireModule(businessId, '/dashboard/store', res))) return;

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
      const {
        heroTitle, heroSubtitle, heroImageUrl, primaryColor, secondaryColor, backgroundColor, themeMode,
        fontPairing, buttonStyle, template, faviconUrl,
        logoUrl, aboutText, aboutImageUrl,
        contactPhone, contactEmail, contactAddress, whatsappNumber,
      } = req.body;

      const fields = {
        heroTitle, heroSubtitle, heroImageUrl, primaryColor, secondaryColor, backgroundColor, themeMode,
        fontPairing, buttonStyle, template, faviconUrl,
        logoUrl, aboutText, aboutImageUrl,
        contactPhone, contactEmail, contactAddress, whatsappNumber,
      };

      const updatedStorefront = await prisma.storefront.upsert({
        where: { businessId },
        update: fields,
        create: { businessId, ...fields },
      });

      return res.status(200).json(updatedStorefront);
    } catch (error) {
      console.error('Error updating storefront:', error);
      return res.status(500).json({ error: 'Error al actualizar la configuración de la tienda' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
