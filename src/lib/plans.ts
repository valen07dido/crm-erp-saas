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
  if (!business.isActive) return false;
  if (business.planExpiresAt && new Date(business.planExpiresAt) < new Date()) return false;
  return true;
}
