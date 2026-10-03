import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user?.email !== 'valendido69@gmail.com') {
    return res.status(403).json({ error: 'Forbidden. Super Admin access required.' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, username, password } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing user ID' });

    const data: { username?: string | null; passwordHash?: string } = {};

    if (username !== undefined) {
      const trimmed = typeof username === 'string' ? username.trim().toLowerCase() : '';
      if (trimmed && !/^[a-z0-9_.-]{3,32}$/.test(trimmed)) {
        return res.status(400).json({ error: 'El usuario debe tener entre 3 y 32 caracteres (letras, números, _ . -)' });
      }
      if (trimmed) {
        const existing = await prisma.user.findFirst({ where: { username: trimmed, NOT: { id } } });
        if (existing) {
          return res.status(409).json({ error: 'Ese usuario ya está en uso por otra cuenta' });
        }
      }
      data.username = trimmed || null;
    }

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 4) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
      }
      data.passwordHash = bcrypt.hashSync(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, username: true, name: true },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Super Admin users PUT error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
