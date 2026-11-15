import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDataSource } from '@/lib/datasource';

/**
 * Every tenant-scoped API route identifies "which business" purely from the
 * client-supplied `x-business-id` header. On its own that's not access
 * control — it's just a label the caller picked. Without this check, any
 * logged-in user (or, before a route also calls this, literally anyone,
 * since most of these routes had no session check at all) could pass a
 * DIFFERENT business's id and read/write that tenant's data.
 *
 * Call this right after validating the header is present, with the caller's
 * `businessId`, and `return` immediately if it resolves to null — the
 * response has already been sent in that case.
 */
export async function requireBusinessMembership(
  req: NextApiRequest,
  res: NextApiResponse,
  businessId: string
): Promise<{ userId: string; role: string } | null> {
  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }
  const dataSource = await getDataSource();
  const membership = await dataSource.membership.find(userId, businessId);
  if (!membership) {
    res.status(403).json({ error: 'No tenés acceso a este negocio' });
    return null;
  }
  return { userId, role: membership.role };
}
