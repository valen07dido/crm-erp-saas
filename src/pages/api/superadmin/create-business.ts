import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const VALID_PLANS = ['BASIC', 'PRO', 'ENTERPRISE'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user?.email !== 'valendido69@gmail.com') {
    return res.status(403).json({ error: 'Forbidden. Super Admin access required.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, password, businessName } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : req.body.email;
  const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : req.body.username;
  const planName = VALID_PLANS.includes(req.body.planName) ? req.body.planName : 'BASIC';
  const planExpiresAt = req.body.planExpiresAt ? new Date(req.body.planExpiresAt) : null;
  const isActive = req.body.isActive !== undefined ? !!req.body.isActive : true;

  if (!email || !username || !password || !businessName) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'El usuario debe tener entre 3 y 32 caracteres (letras, números, _ . -)' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      return res.status(409).json({
        error: existing.email === email ? 'El email ya está registrado' : 'El usuario ya está en uso',
      });
    }

    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          name,
          passwordHash: bcrypt.hashSync(password, 10),
        },
      });

      const business = await tx.business.create({
        data: {
          name: businessName,
          slug,
          ownerId: user.id,
          planName,
          planExpiresAt,
          isActive,
        },
      });

      const role = await tx.role.create({
        data: {
          name: `owner-${business.id}`,
          description: 'Propietario del negocio',
          businessId: business.id,
        },
      });

      await tx.businessUser.create({
        data: {
          userId: user.id,
          businessId: business.id,
          roleId: role.id,
          role: 'ADMIN',
        },
      });

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
      message: 'Negocio creado exitosamente',
      userId: result.user.id,
      businessId: result.business.id,
    });
  } catch (error) {
    console.error('Super Admin create-business error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
