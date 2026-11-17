import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SUPERADMIN_EMAIL } from '@/lib/superadmin';

/**
 * Guard for WALTI-internal API routes (Marketing Studio). Returns false and
 * answers 403 itself when the caller isn't the platform owner — call it first
 * and `return` if it resolves to false.
 */
export async function requireSuperAdmin(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user?.email !== SUPERADMIN_EMAIL) {
    res.status(403).json({ error: 'Acceso restringido al equipo de WALTI.' });
    return false;
  }
  return true;
}
