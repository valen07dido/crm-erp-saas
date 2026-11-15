// Which sidebar modules each plan unlocks. Adjust these lists to change what
// a plan includes — nothing else in the app needs to change.
const BASIC_MODULES = [
  '/dashboard',
  '/dashboard/pos',
  '/dashboard/products',
  '/dashboard/clients',
  '/dashboard/sales',
  '/dashboard/tutorials',
  '/dashboard/settings',
  '/dashboard/team',
];

const PRO_MODULES = [
  ...BASIC_MODULES,
  '/dashboard/offers',
  '/dashboard/suppliers',
  '/dashboard/purchases',
  '/dashboard/cash-register',
  '/dashboard/expenses',
];

const ENTERPRISE_MODULES = [
  ...PRO_MODULES,
  '/dashboard/reports',
  '/dashboard/store',
];

export const PLAN_MODULES: Record<string, string[]> = {
  BASIC: BASIC_MODULES,
  PRO: PRO_MODULES,
  ENTERPRISE: ENTERPRISE_MODULES,
};

export const PLAN_LABELS: Record<string, string> = {
  BASIC: 'Básico',
  PRO: 'Profesional',
  ENTERPRISE: 'Premium',
};

export function isModuleAllowed(planName: string | null | undefined, pathname: string): boolean {
  // WALTI Desktop bakes this flag in at build time (see next.config.js) —
  // it's a single-license product, not a tiered SaaS plan, so every module
  // the sidebar could ever show is always unlocked.
  if (process.env.NEXT_PUBLIC_WALTI_DESKTOP_BUILD === '1') return true;

  const modules = PLAN_MODULES[planName || 'BASIC'] || PLAN_MODULES.BASIC;
  return modules.some((m) => {
    // '/dashboard' is the home page itself — treating it as a prefix would
    // match every other dashboard route too, since they all start with it.
    if (m === '/dashboard') return pathname === '/dashboard';
    return pathname === m || pathname.startsWith(m + '/');
  });
}

export interface BusinessStatus {
  isActive: boolean;
  planExpiresAt: string | Date | null;
}

export function isAccountActive(business: BusinessStatus): boolean {
  // Same reasoning as isModuleAllowed: WALTI Desktop has no plan/expiration
  // concept at all (the local `businesses` row doesn't even have these
  // columns) — licensing (separate from this) is its own system.
  if (process.env.NEXT_PUBLIC_WALTI_DESKTOP_BUILD === '1') return true;
  if (!business.isActive) return false;
  if (business.planExpiresAt && new Date(business.planExpiresAt) < new Date()) return false;
  return true;
}
