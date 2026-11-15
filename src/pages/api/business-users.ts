import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDataSource } from '@/lib/datasource';

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

  const dataSource = await getDataSource();

  const callerMembership = await dataSource.membership.find(callerId, businessId);
  if (!callerMembership || callerMembership.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo un administrador puede gestionar usuarios' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const businessUsers = await dataSource.businessUsers.list(businessId);
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
        if (password.length < 8) {
          return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const conflict = await dataSource.businessUsers.findConflict(normalizedEmail, normalizedUsername);
        if (conflict) {
          return res.status(409).json({ error: conflict === 'email' ? 'El email ya está registrado' : 'El usuario ya está en uso' });
        }

        const result = await dataSource.businessUsers.create({
          businessId,
          name: name || null,
          email: normalizedEmail,
          username: normalizedUsername,
          password,
          role: finalRole,
        });

        return res.status(201).json(result);
      }

      case 'PUT': {
        // Change an existing staff member's role and/or reset their password
        const { id, role, password } = req.body as { id?: string; role?: string; password?: string };
        if (!id) return res.status(400).json({ error: 'Datos inválidos' });
        if (role !== undefined && role !== 'ADMIN' && role !== 'POS') {
          return res.status(400).json({ error: 'Rol inválido' });
        }
        if (password !== undefined && password.length < 8) {
          return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const target = await dataSource.businessUsers.findById(id);
        if (!target || target.businessId !== businessId) {
          return res.status(404).json({ error: 'Usuario no encontrado en este negocio' });
        }

        const updated = await dataSource.businessUsers.update(id, businessId, { role, password });
        return res.status(200).json(updated);
      }

      case 'DELETE': {
        const { id } = req.query as { id: string };
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const target = await dataSource.businessUsers.findById(id);
        if (!target || target.businessId !== businessId) {
          return res.status(404).json({ error: 'Usuario no encontrado en este negocio' });
        }
        if (target.userId === callerId) {
          return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
        }
        await dataSource.businessUsers.delete(id, businessId);
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
