// Shared, module-scoped cache of the last /api/me response. Several dashboard
// pages need the business's plan/role before deciding what to render, and
// since Next.js (Pages Router) remounts a page's component on every client-side
// navigation, a plain useState would start over from "unknown" each time —
// which is what used to cause a brief flash of modules the plan doesn't
// actually include. Caching the value here (it survives remounts within the
// same client-side session) lets a fresh mount render the right thing on its
// very first paint, while still re-fetching in the background to stay fresh.
export interface MeCache {
  business: any;
  role: string | null;
}

let cached: MeCache | null = null;

export function getCachedMe(): MeCache | null {
  return cached;
}

export function setCachedMe(value: MeCache) {
  cached = value;
}
