import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, password, businessName } = req.body;

  if (!email || !password || !businessName) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    // Create slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    // Create user + business in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user (NOTE: hash password with bcrypt in production!)
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash: password, // TODO: bcrypt.hashSync(password, 10)
        },
      });

      // Create business
      const business = await tx.business.create({
        data: {
          name: businessName,
          slug,
          ownerId: user.id,
        },
      });

      // Create default role
      const role = await tx.role.create({
        data: {
          name: `owner-${business.id}`,
          description: 'Propietario del negocio',
          businessId: business.id,
        },
      });

      // Link user to business
      await tx.businessUser.create({
        data: {
          userId: user.id,
          businessId: business.id,
          roleId: role.id,
        },
      });

      // Create business settings
      await tx.businessSettings.create({
        data: {
          businessId: business.id,
          currency: 'ARS',
          taxRate: 21,
        },
      });

      return { user, business };
    });

    return res.status(201).json({
      message: 'Cuenta creada exitosamente',
      userId: result.user.id,
      businessId: result.business.id,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
