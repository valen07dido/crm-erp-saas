import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

// Read-only: only the sidebar uses this, to show the business's own logo in
// its own dashboard (not the public storefront, so it isn't plan-gated).
// Editing the storefront itself happens through the Enterprise-only
// /api/storefront endpoint.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const storefront = await prisma.storefront.findUnique({
      where: { businessId }
    });
    return res.status(200).json(storefront || {});
  } catch (error) {
    console.error('Storefront settings API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
