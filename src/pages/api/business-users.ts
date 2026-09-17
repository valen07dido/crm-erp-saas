import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Lets a business's ADMIN manage the staff logins for their OWN business
 * (not superadmin — this is scoped to a single business, unlike
 * /api/superadmin/*). Roles: "ADMIN" (full access) or "POS" (Punto de Venta only).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  const session = await getServerSession(req, res, authOptions);
  const callerId = (session?.user as any)?.id;
  if (!callerId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const callerMembership = await prisma.businessUser.findFirst({ where: { userId: callerId, businessId } });
  if (!callerMembership || callerMembership.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo un administrador puede gestionar usuarios' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const businessUsers = await prisma.businessUser.findMany({
          where: { businessId },
          include: { user: { select: { id: true, email: true, username: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        });
        return res.status(200).json(businessUsers);
      }

      case 'POST': {
        const { name, email, username, password, role } = req.body as {
          name?: string;
          email?: string;
          username?: string;
          password?: string;
          role?: string;
        };

        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
        const finalRole = role === 'POS' ? 'POS' : 'ADMIN';

        if (!normalizedEmail || !normalizedUsername || !password) {
          return res.status(400).json({ error: 'Email, usuario y contraseña son obligatorios' });
        }
        if (!/^[a-z0-9_.-]{3,32}$/.test(normalizedUsername)) {
          return res.status(400).json({ error: 'El usuario debe tener entre 3 y 32 caracteres (letras, números, _ . -)' });
        }
        if (password.length < 4) {
          return res.status(400).json({ error: 'La contraseña es muy corta' });
        }

        const existing = await prisma.user.findFirst({
          where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
        });
        if (existing) {
          return res.status(409).json({
            error: existing.email === normalizedEmail ? 'El email ya está registrado' : 'El usuario ya está en uso',
          });
        }

        // This business's own placeholder Role row (created at signup) — reused
        // as the FK target; actual access is gated by BusinessUser.role (string).
        let placeholderRole = await prisma.role.findFirst({ where: { businessId } });
        if (!placeholderRole) {
          placeholderRole = await prisma.role.create({
            data: { name: `staff-${businessId}`, businessId },
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: normalizedEmail,
              username: normalizedUsername,
              name: name || null,
              passwordHash: bcrypt.hashSync(password, 10),
            },
          });
          const businessUser = await tx.businessUser.create({
            data: {
              userId: user.id,
              businessId,
              roleId: placeholderRole!.id,
              role: finalRole,
            },
            include: { user: { select: { id: true, email: true, username: true, name: true } } },
          });
          return businessUser;
        });

        return res.status(201).json(result);
      }

      case 'PUT': {
        // Change an existing staff member's role
        const { id, role } = req.body as { id?: string; role?: string };
        if (!id || (role !== 'ADMIN' && role !== 'POS')) {
          return res.status(400).json({ error: 'Datos inválidos' });
        }
        const target = await prisma.businessUser.findUnique({ where: { id } });
        if (!target || target.businessId !== businessId) {
          return res.status(404).json({ error: 'Usuario no encontrado en este negocio' });
        }
        const updated = await prisma.businessUser.update({
          where: { id },
          data: { role },
          include: { user: { select: { id: true, email: true, username: true, name: true } } },
        });
        return res.status(200).json(updated);
      }

      case 'DELETE': {
        const { id } = req.query as { id: string };
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const target = await prisma.businessUser.findUnique({ where: { id } });
        if (!target || target.businessId !== businessId) {
          return res.status(404).json({ error: 'Usuario no encontrado en este negocio' });
        }
        if (target.userId === callerId) {
          return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
        }
        await prisma.businessUser.delete({ where: { id } });
        return res.status(204).end();
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('business-users API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
