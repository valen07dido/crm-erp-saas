import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { isModuleAllowed } from '@/lib/plans';
import { isModuleAllowedForRole } from '@/lib/roles';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Truck,
  DollarSign,
  BarChart3,
  Settings,
  Store,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Wallet,
  ClipboardList,
  ScanBarcode,
  BookOpen,
  Gift,
  X,
  UserCog,
} from 'lucide-react';

// Grouped purely for visual organization in the nav — has no effect on
// which items are shown (that's still isModuleAllowed/isModuleAllowedForRole
// below) or on their routes.
const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', group: null },
  { label: 'Punto de Venta', icon: ScanBarcode, href: '/dashboard/pos', group: null },
  { label: 'Productos', icon: Package, href: '/dashboard/products', group: 'Comercial' },
  { label: 'Ofertas', icon: Gift, href: '/dashboard/offers', group: 'Comercial' },
  { label: 'Clientes', icon: Users, href: '/dashboard/clients', group: 'Comercial' },
  { label: 'Ventas', icon: ShoppingCart, href: '/dashboard/sales', group: 'Comercial' },
  { label: 'Proveedores', icon: Truck, href: '/dashboard/suppliers', group: 'Operación' },
  { label: 'Compras', icon: ClipboardList, href: '/dashboard/purchases', group: 'Operación' },
  { label: 'Caja', icon: Wallet, href: '/dashboard/cash-register', group: 'Operación' },
  { label: 'Gastos', icon: DollarSign, href: '/dashboard/expenses', group: 'Operación' },
  { label: 'Reportes', icon: BarChart3, href: '/dashboard/reports', group: 'Análisis' },
  { label: 'Tienda Online', icon: Store, href: '/dashboard/store', group: 'Análisis' },
  { label: 'Usuarios', icon: UserCog, href: '/dashboard/team', adminOnly: true, group: 'Cuenta' },
  { label: 'Tutoriales', icon: BookOpen, href: '/dashboard/tutorials', group: 'Cuenta' },
  { label: 'Configuración', icon: Settings, href: '/dashboard/settings', group: 'Cuenta' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  businessId: string | null;
  businessName: string;
  planName: string | null;
  role: string | null;
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, businessId, businessName, planName, role }: SidebarProps) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    const loadLogo = async () => {
      try {
        const sfRes = await fetch('/api/storefront-settings', {
          headers: { 'x-business-id': businessId },
        });
        if (!sfRes.ok) return;
        const sf = await sfRes.json();
        if (!cancelled && sf?.logoUrl) setLogoUrl(sf.logoUrl);
      } catch { }
    };
    loadLogo();
    return () => { cancelled = true; };
  }, [businessId]);

  // planName/role come from DashboardLayout, which only renders this sidebar
  // once /api/me has actually resolved (from cache or a fresh request) — so
  // by the time this runs they're never "still loading", and `isModuleAllowed`
  // defaults to the BASIC plan on the rare null case (e.g. the request failed).
  const visibleMenuItems = menuItems
    .filter((item) => isModuleAllowed(planName, item.href))
    .filter((item) => isModuleAllowedForRole(role, item.href))
    .filter((item) => !item.adminOnly || role !== 'POS');

  // Preserve the groups' declared order, but only the ones that still have
  // at least one visible item after the plan/role filtering above.
  const groupOrder = [null, 'Comercial', 'Operación', 'Análisis', 'Cuenta'] as const;
  const groupedItems = groupOrder
    .map((group) => ({ group, items: visibleMenuItems.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* The sidebar is fixed graphite chrome in BOTH themes (brief section 5)
          — it deliberately opts out of the light/dark background/foreground
          tokens, so its own text/hover colors are hand-picked here instead
          of the usual muted-foreground/accent utilities. */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-graphite transition-transform duration-300 md:z-40 md:transition-all',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
          collapsed ? 'md:w-[72px]' : 'md:w-[260px]'
        )}
      >
        {/* Branding — this is WALTI's own identity, not the tenant's. The
            business's name/logo live in the profile zone at the bottom
            instead; showing both up here read as redundant/competing. */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center overflow-hidden">
              {/* The navy wordmark is the original logo's real color, kept
                  untouched — the white chip behind it is just so it reads
                  against the graphite sidebar, nothing about the asset itself
                  is recolored. */}
              <span className="flex h-11 shrink-0 items-center rounded-xl bg-white px-4 py-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-sidebar.png" alt="Walti" className="h-6 w-auto object-contain" />
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto hidden md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.png" alt="Walti" className="h-10 w-10 object-contain" />
            </Link>
          )}
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toggle (desktop collapse) */}
        <button
          onClick={onToggleCollapsed}
          className="absolute -right-3 top-24 z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-graphite text-white/60 shadow-md transition-colors hover:bg-white/10 hover:text-white md:flex"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-4">
            {groupedItems.map(({ group, items }) => (
              <div key={group ?? 'core'} className="flex flex-col gap-1">
                {group && !collapsed && (
                  <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    {group}
                  </span>
                )}
                {items.map((item) => {
                  const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-lime text-graphite shadow-sm'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                        collapsed && 'md:justify-center md:px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Profile zone */}
        <div className="shrink-0 border-t border-white/10 p-3">
          {!collapsed && (businessName || role) && (
            <div className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2">
              {logoUrl ? (
                <img src={logoUrl} alt={businessName} className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime text-xs font-bold text-graphite">
                  {businessName ? businessName.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{businessName}</p>
                <p className="text-xs text-white/70">{role === 'POS' ? 'Punto de Venta' : 'Administrador'}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-all duration-200 hover:bg-destructive/20 hover:text-red-300',
              collapsed && 'md:justify-center md:px-2'
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn(collapsed && 'md:hidden')}>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}

