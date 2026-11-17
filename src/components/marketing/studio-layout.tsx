import React, { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  BadgePercent,
  CalendarDays,
  Clapperboard,
  Download,
  Images,
  LayoutGrid,
  Megaphone,
  Palette,
  PenLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPERADMIN_EMAIL } from '@/lib/superadmin';
import { Spinner } from './studio-ui';

const NAV = [
  { href: '/superadmin/marketing', label: 'Inicio', icon: LayoutGrid, exact: true },
  { href: '/superadmin/marketing/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/superadmin/marketing/designs', label: 'Diseños', icon: Images },
  { href: '/superadmin/marketing/copy', label: 'Textos', icon: PenLine },
  { href: '/superadmin/marketing/brand', label: 'Marca', icon: Palette },
  { href: '/superadmin/marketing/exports', label: 'Exportar', icon: Download },
];

// Listed so the roadmap is visible, but not clickable: they don't exist yet.
const NEXT = [
  { label: 'Reels', icon: Clapperboard },
  { label: 'Promos', icon: BadgePercent },
  { label: 'Agenda', icon: CalendarDays },
];

function StudioMark() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ivory p-1.5">
        {/* Original isotipo, untouched. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.png" alt="WALTI" className="h-full w-full object-contain" />
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-lime">Studio</span>
    </div>
  );
}

export function useSuperAdminGate() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const ok = status === 'authenticated' && session?.user?.email === SUPERADMIN_EMAIL;
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/login');
    else if (status === 'authenticated' && session?.user?.email !== SUPERADMIN_EMAIL) router.replace('/dashboard');
  }, [status, session, router]);
  return ok;
}

export default function StudioLayout({
  title,
  subtitle,
  actions,
  children,
  bleed,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Full-height workspace without page padding (editor). */
  bleed?: boolean;
}) {
  const router = useRouter();
  const ok = useSuperAdminGate();

  return (
    <div className="dark">
      <Head>
        <title>{`${title} · WALTI Marketing Studio`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="flex min-h-screen bg-background text-foreground">
        <aside className="sticky top-0 z-30 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r border-border bg-graphite py-4 md:flex">
          <Link href="/superadmin/marketing" aria-label="Inicio del Studio">
            <StudioMark />
          </Link>
          <nav className="mt-6 flex flex-1 flex-col items-center gap-1">
            {NAV.map((item) => {
              const active = item.exact ? router.pathname === item.href : router.pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex w-[60px] flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors',
                    active ? 'bg-white/[0.07] text-foreground' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                  )}
                >
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', active && 'bg-primary text-primary-foreground')}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
            <div className="my-3 h-px w-8 bg-border" />
            {NEXT.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  title={`${item.label}: próxima etapa`}
                  className="flex w-[60px] cursor-default flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground/40"
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </div>
              );
            })}
          </nav>
          <Link
            href="/superadmin"
            title="Volver al panel de Superadmin"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile nav: same items, horizontal. */}
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-graphite px-3 py-2 md:hidden">
            {NAV.map((item) => {
              const active = item.exact ? router.pathname === item.href : router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {!ok ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : bleed ? (
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          ) : (
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 md:px-8 md:py-8">
              <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-lime/90">WALTI Marketing Studio</p>
                  <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
                  {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
              </header>
              {children}
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
