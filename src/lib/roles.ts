// A "POS" business user only ever needs the Punto de Venta screen (plus the
// help content) — every other module is reserved for "ADMIN" users.
const POS_ROLE_MODULES = ['/dashboard/pos', '/dashboard/tutorials'];

export function isModuleAllowedForRole(role: string | null | undefined, pathname: string): boolean {
  if (role !== 'POS') return true;
  return POS_ROLE_MODULES.some((m) => pathname === m || pathname.startsWith(m + '/'));
}
