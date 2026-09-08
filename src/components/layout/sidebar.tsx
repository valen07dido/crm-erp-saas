import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { isModuleAllowed } from '@/lib/plans';
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
} from 'lucide-react';

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Punto de Venta', icon: ScanBarcode, href: '/dashboard/pos' },
  { label: 'Productos', icon: Package, href: '/dashboard/products' },
  { label: 'Ofertas', icon: Gift, href: '/dashboard/offers' },
  { label: 'Clientes', icon: Users, href: '/dashboard/clients' },
  { label: 'Ventas', icon: ShoppingCart, href: '/dashboard/sales' },
  { label: 'Proveedores', icon: Truck, href: '/dashboard/suppliers' },
  { label: 'Compras', icon: ClipboardList, href: '/dashboard/purchases' },
  { label: 'Caja', icon: Wallet, href: '/dashboard/cash-register' },
  { label: 'Gastos', icon: DollarSign, href: '/dashboard/expenses' },
  { label: 'Reportes', icon: BarChart3, href: '/dashboard/reports' },
  { label: 'Tienda Online', icon: Store, href: '/dashboard/store' },
  { label: 'Tutoriales', icon: BookOpen, href: '/dashboard/tutorials' },
  { label: 'Configuración', icon: Settings, href: '/dashboard/settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('MiNegocio');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const { business } = await meRes.json();
        if (business?.name) setBusinessName(business.name);
        if (business?.planName) setPlanName(business.planName);

        // Try to load storefront settings for logo
        const sfRes = await fetch('/api/storefront-settings', {
          headers: { 'x-business-id': business.id },
        });
        if (sfRes.ok) {
          const sf = await sfRes.json();
          if (sf?.logoUrl) setLogoUrl(sf.logoUrl);
        }
      } catch {}
    };
    loadBranding();
  }, []);

  const visibleMenuItems = planName
    ? menuItems.filter((item) => isModuleAllowed(planName, item.href))
    : menuItems;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-border/50 bg-card/95 backdrop-blur-xl transition-transform duration-300 md:z-40 md:bg-card/80 md:transition-all',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
          collapsed ? 'md:w-[72px]' : 'md:w-[260px]'
        )}
      >
        {/* Logo / Branding */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={businessName} className="h-9 w-9 rounded-lg object-cover shadow-md" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary shadow-md">
                  <Store className="h-4.5 w-4.5 text-white" />
                </div>
              )}
              <span className="truncate text-lg font-bold gradient-text">{businessName}</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto hidden md:block">
              {logoUrl ? (
                <img src={logoUrl} alt={businessName} className="h-9 w-9 rounded-lg object-cover shadow-md" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary shadow-md">
                  <Store className="h-4.5 w-4.5 text-white" />
                </div>
              )}
            </Link>
          )}
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toggle (desktop collapse) */}
        <button
          onClick={onToggleCollapsed}
          className="absolute -right-3 top-20 z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground md:flex"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {visibleMenuItems.map((item) => {
              const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
              const isPOS = item.href === '/dashboard/pos';
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    isPOS && !isActive && 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10',
                    collapsed && 'md:justify-center md:px-2'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary', isPOS && !isActive && 'text-emerald-400')} />
                  <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-border/50 bg-card/95 p-3 backdrop-blur-xl">
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-red-400',
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

