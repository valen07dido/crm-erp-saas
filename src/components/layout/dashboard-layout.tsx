import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import { AlertTriangle, Lock, LogOut } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { InactivityTimer } from '@/components/auth/inactivity-timer';
import { isAccountActive, isModuleAllowed } from '@/lib/plans';
import { isModuleAllowedForRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type AccessStatus = 'loading' | 'ok' | 'blocked' | 'locked-module';

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [status, setStatus] = useState<AccessStatus>('loading');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile drawer whenever the route changes (e.g. browser back/forward).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    let cancelled = false;
    const checkAccess = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.status === 401) {
          if (!cancelled) router.replace('/auth/login?reason=expired');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setStatus('ok');
          return;
        }
        const { business, role } = await res.json();
        if (cancelled) return;
        if (!business || !isAccountActive(business)) {
          setStatus('blocked');
          return;
        }
        if (!isModuleAllowedForRole(role, router.pathname)) {
          router.replace('/dashboard/pos');
          return; // keep showing the loading spinner until the redirect lands
        }
        setStatus(isModuleAllowed(business.planName, router.pathname) ? 'ok' : 'locked-module');
      } catch {
        if (!cancelled) setStatus('ok');
      }
    };
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [router.pathname]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Su cuenta no está al día</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Llame al administrador para regularizar su situación y recuperar el acceso al sistema.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="mt-6 flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    );
  }

  const locked = status === 'locked-module';

  return (
    <div className="min-h-screen bg-background">
      <InactivityTimer />
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className={cn('transition-all duration-300', collapsed ? 'md:ml-[72px]' : 'md:ml-[260px]')}>
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        {locked ? (
          <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <Lock className="h-8 w-8 text-amber-400" />
            </div>
            <h1 className="mt-6 text-2xl font-bold">Módulo no disponible en tu plan</h1>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Esta sección no está incluida en tu plan actual. Comunicate con el administrador para ampliarlo.
            </p>
          </main>
        ) : (
          <main className="p-6 animate-fade-in">{children}</main>
        )}
      </div>
    </div>
  );
}
