import type { NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { isModuleAllowed } from '@/lib/plans';

/**
 * Server-side counterpart to `isModuleAllowed` (lib/plans.ts, which the UI
 * uses to hide/lock screens). The UI gate alone isn't enough — anyone can
 * call these APIs directly (devtools, curl) bypassing the dashboard, so the
 * plan has to be enforced here too for Pro/Enterprise-only modules.
 * Writes `res` and returns false when the business's plan doesn't include
 * `modulePath`; callers should `return` immediately in that case.
 */
export async function requireModule(
  businessId: string,
  modulePath: string,
  res: NextApiResponse
): Promise<boolean> {
  // WALTI Desktop is a single-install, single-license product — there's no
  // concept of a plan tier to gate against (no `planName` column exists on
  // the local `businesses` table at all). Every module is always allowed.
  if (process.env.WALTI_RUNTIME === 'desktop') return true;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { planName: true },
  });
  if (!business || !isModuleAllowed(business.planName, modulePath)) {
    res.status(403).json({ error: 'Esta función no está incluida en tu plan' });
    return false;
  }
  return true;
}
