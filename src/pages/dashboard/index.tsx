import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Package,
  ShoppingCart,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Trophy,
  PieChart,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  salesToday: number;
  salesYesterday: number;
  salesMonth: number;
  salesLastMonth: number;
  productsInStock: number;
  totalClients: number;
  recentSales: { id: string; total: number; status: string; createdAt: string; clientName: string }[];
  lowStockProducts: { id: string; name: string; stock: number }[];
  salesSeries: { date: string; total: number }[];
  topProducts: { id: string; name: string; quantity: number; revenue: number }[];
  salesByCategory: { category: string; revenue: number }[];
  topClients: { id: string; name: string; total: number }[];
}

const money = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};

// null = no real previous-period figure to compare against — the caller
// should just not render a trend badge rather than show a fabricated one.
function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        flat
          ? 'bg-muted text-muted-foreground'
          : up
          ? 'bg-success/15 text-success'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(0)}% vs. período anterior
    </span>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'month'>('month');

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const { business } = await meRes.json();
          const statsRes = await fetch('/api/stats', {
            headers: { 'x-business-id': business.id },
          });
          if (statsRes.ok) {
            const data = await statsRes.json();
            setStats(data);
          }
        }
      } catch (e) {
        console.error('Error loading dashboard stats', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const base = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const firstName = session?.user?.name?.split(' ')[0];
    return firstName ? `${base}, ${firstName}` : base;
  }, [session?.user?.name]);

  const heroValue = period === 'today' ? stats?.salesToday ?? 0 : stats?.salesMonth ?? 0;
  const heroPrev = period === 'today' ? stats?.salesYesterday ?? 0 : stats?.salesLastMonth ?? 0;
  const heroPct = stats ? pctChange(heroValue, heroPrev) : null;

  const maxCategory = Math.max(1, ...(stats?.salesByCategory.map((c) => c.revenue) ?? [1]));
  const maxProduct = Math.max(1, ...(stats?.topProducts.map((p) => p.revenue) ?? [1]));

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
          <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Una mirada general de tu negocio</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(['today', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'today' ? 'Hoy' : 'Este mes'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* A + B — Main indicator and secondary stats, deliberately asymmetric */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {period === 'today' ? 'Ventas de hoy' : 'Ventas de este mes'}
                </p>
                <TrendBadge pct={heroPct} />
              </div>
              <p className="mt-2 font-heading font-mono text-4xl font-bold tracking-tight sm:text-5xl">
                {money(heroValue)}
              </p>
              <div className="mt-6 h-20">
                {period === 'month' ? (
                  stats?.salesSeries.some((s) => s.total > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.salesSeries} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgb(var(--lime))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="rgb(var(--lime))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke="rgb(var(--secondary))"
                          strokeWidth={2}
                          fill="url(#heroSpark)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="flex h-full items-center text-xs text-muted-foreground">
                      Todavía no hay ventas en los últimos 14 días para mostrar una tendencia.
                    </p>
                  )
                ) : (
                  // "Hoy" is a single point in time, not a trend over days — we
                  // only have day-level totals (no intraday data), so a 14-day
                  // curve here would just be the month chart in disguise and
                  // imply an "evolution" within today that we can't actually
                  // see. A direct Hoy-vs-Ayer comparison is the honest version
                  // of "evolución visual" at this granularity.
                  <div className="flex h-full flex-col justify-center gap-3">
                    {[
                      { label: 'Ayer', value: stats?.salesYesterday ?? 0 },
                      { label: 'Hoy', value: stats?.salesToday ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-10 shrink-0 text-xs text-muted-foreground">{label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={label === 'Hoy' ? 'h-full rounded-full bg-primary' : 'h-full rounded-full bg-secondary'}
                            style={{
                              width: `${Math.max(
                                4,
                                (value / Math.max(1, stats?.salesToday ?? 0, stats?.salesYesterday ?? 0)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">{money(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-1 items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {period === 'today' ? 'Ventas del mes' : 'Ventas de hoy'}
                  </p>
                  <p className="font-mono text-xl font-bold">
                    {money(period === 'today' ? stats?.salesMonth ?? 0 : stats?.salesToday ?? 0)}
                  </p>
                </div>
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-1 items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Productos en stock</p>
                  <p className="font-mono text-xl font-bold">{stats?.productsInStock ?? 0}</p>
                </div>
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-1 items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Clientes registrados</p>
                  <p className="font-mono text-xl font-bold">{stats?.totalClients ?? 0}</p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* C — Evolution chart, full width */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Evolución de ventas</h2>
            <p className="text-xs text-muted-foreground">Últimos 14 días</p>
            <div className="mt-4 h-56">
              {stats?.salesSeries.some((s) => s.total > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.salesSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(var(--lime))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="rgb(var(--lime))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDay}
                      tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'rgb(var(--border))' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(value) => [money(Number(value ?? 0)), 'Ventas']}
                      labelFormatter={(label) => shortDay(String(label ?? ''))}
                      contentStyle={{
                        backgroundColor: 'rgb(var(--popover))',
                        border: '1px solid rgb(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="rgb(var(--secondary))"
                      strokeWidth={2.5}
                      fill="url(#evoFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={ShoppingCart}
                  title="Sin ventas en los últimos 14 días"
                  description="Las ventas que registres en el Punto de Venta van a aparecer acá."
                  action={{ label: 'Ir al Punto de Venta', href: '/dashboard/pos' }}
                />
              )}
            </div>
          </div>

          {/* C — Ranking, category breakdown, top clients */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <Trophy className="h-4 w-4 text-secondary" />
                Productos más vendidos
              </h2>
              <p className="text-xs text-muted-foreground">Este mes, por ingresos</p>
              <div className="mt-4 flex-1">
                {!stats?.topProducts.length ? (
                  <EmptyState icon={Trophy} title="Sin ventas de productos este mes" />
                ) : (
                  <ul className="space-y-3">
                    {stats.topProducts.map((p) => (
                      <li key={p.id}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate pr-2 font-medium">{p.name}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{money(p.revenue)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-secondary"
                            style={{ width: `${Math.max(4, (p.revenue / maxProduct) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <PieChart className="h-4 w-4 text-secondary" />
                Ventas por categoría
              </h2>
              <p className="text-xs text-muted-foreground">Este mes, por ingresos</p>
              <div className="mt-4 flex-1">
                {!stats?.salesByCategory.length ? (
                  <EmptyState
                    icon={PieChart}
                    title="Sin datos de categoría"
                    description="Asigná una categoría a tus productos para ver esta distribución."
                    action={{ label: 'Ir a Productos', href: '/dashboard/products' }}
                  />
                ) : (
                  <ul className="space-y-3">
                    {stats.salesByCategory.map((c) => (
                      <li key={c.category}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate pr-2 font-medium">{c.category}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{money(c.revenue)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(4, (c.revenue / maxCategory) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <UserCheck className="h-4 w-4 text-secondary" />
                Mejores clientes
              </h2>
              <p className="text-xs text-muted-foreground">Este mes, por gasto</p>
              <div className="mt-4 flex-1">
                {!stats?.topClients.length ? (
                  <EmptyState
                    icon={UserCheck}
                    title="Sin compras con cliente asociado"
                    description="Elegí un cliente al cobrar en el Punto de Venta para ver este ranking."
                  />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {stats.topClients.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0">
                        <span className="truncate pr-2 font-medium">{c.name}</span>
                        <span className="shrink-0 font-mono text-xs font-semibold">{money(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* D — Operación y control */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm lg:col-span-1">
              <div className="flex items-center justify-between border-b border-border p-5">
                <h2 className="font-heading text-base font-semibold">Últimas ventas</h2>
                <Link href="/dashboard/sales" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  Ver todas <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex-1">
                {!stats?.recentSales.length ? (
                  <EmptyState icon={ShoppingCart} title="No hay ventas registradas aún" />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {stats.recentSales.map((sale) => (
                      <li key={sale.id} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30">
                        <div>
                          <p className="font-medium">{sale.clientName}</p>
                          <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString('es-AR')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold">{money(sale.total)}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              sale.status === 'PENDING_WEB' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'
                            }`}
                          >
                            {sale.status === 'PENDING_WEB' ? 'Web' : 'Local'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Stock crítico
                </h2>
                <Link href="/dashboard/products" className="text-sm text-primary hover:underline">
                  Gestionar
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!stats?.lowStockProducts.length ? (
                  <EmptyState icon={Package} title="Inventario saludable" />
                ) : (
                  <ul className="space-y-3">
                    {stats.lowStockProducts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                        <span className="truncate pr-2 text-sm font-medium">{p.name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                          {p.stock} unid.
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-graphite p-6 text-center shadow-sm">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lime/15">
                <ShoppingCart className="h-7 w-7 text-lime" />
              </div>
              <h2 className="font-heading text-lg font-bold text-white">Punto de Venta</h2>
              <p className="mb-6 text-sm text-white/60">Escaneá productos y registrá ventas de forma rápida.</p>
              <Link
                href="/dashboard/pos"
                className="w-full rounded-lg bg-lime px-4 py-3 text-sm font-bold text-graphite shadow-lg transition-all hover:brightness-95"
              >
                Abrir POS
              </Link>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
