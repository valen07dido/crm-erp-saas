import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  salesToday: number;
  salesMonth: number;
  productsInStock: number;
  totalClients: number;
  recentSales: {
    id: string;
    total: number;
    status: string;
    createdAt: string;
    clientName: string;
  }[];
  lowStockProducts: {
    id: string;
    name: string;
    stock: number;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const { business } = await meRes.json();
          const statsRes = await fetch('/api/stats', {
            headers: { 'x-business-id': business.id }
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

  const statCards = [
    {
      label: 'Ventas del día',
      value: stats ? `$${stats.salesToday.toFixed(2)}` : '$0.00',
      change: 'Hoy',
      trend: 'up' as const,
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-600',
      shadowColor: 'shadow-emerald-500/20',
    },
    {
      label: 'Productos',
      value: stats ? stats.productsInStock.toString() : '0',
      change: 'En stock',
      trend: 'up' as const,
      icon: Package,
      color: 'from-blue-500 to-indigo-600',
      shadowColor: 'shadow-blue-500/20',
    },
    {
      label: 'Ventas del mes',
      value: stats ? `$${stats.salesMonth.toFixed(2)}` : '$0.00',
      change: 'Mes actual',
      trend: 'up' as const,
      icon: ShoppingCart,
      color: 'from-violet-500 to-purple-600',
      shadowColor: 'shadow-violet-500/20',
    },
    {
      label: 'Clientes',
      value: stats ? stats.totalClients.toString() : '0',
      change: 'Registrados',
      trend: 'up' as const,
      icon: Users,
      color: 'from-amber-500 to-orange-600',
      shadowColor: 'shadow-amber-500/20',
    },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Resumen general de tu negocio</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, i) => (
              <div
                key={stat.label}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-md animate-slide-up"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-muted p-2.5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                    <TrendingUp className="h-3 w-3" />
                    {stat.change}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Recent Sales */}
            <div className="col-span-1 md:col-span-2 lg:col-span-1 rounded-xl border border-border/50 bg-card shadow-lg flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-border/50">
                <h2 className="text-lg font-semibold">Últimas ventas</h2>
                <Link href="/dashboard/sales" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  Ver todas <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex-1">
                {!stats?.recentSales?.length ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-muted-foreground">
                    <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">No hay ventas registradas aún</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {stats.recentSales.map(sale => (
                      <li key={sale.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div>
                          <p className="font-medium">{sale.clientName}</p>
                          <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">${sale.total.toFixed(2)}</p>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${sale.status === 'PENDING_WEB' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {sale.status === 'PENDING_WEB' ? 'Web' : 'Local'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Low Stock Alert */}
            <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-red-500" />
                  Stock Crítico
                </h2>
                <Link href="/dashboard/products" className="text-sm text-primary hover:underline">
                  Gestionar
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!stats?.lowStockProducts?.length ? (
                  <div className="flex h-full flex-col items-center justify-center py-8 text-muted-foreground">
                    <Package className="mb-2 h-10 w-10 opacity-30" />
                    <p className="text-sm">Inventario saludable</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {stats.lowStockProducts.map(p => (
                      <li key={p.id} className="flex items-center justify-between border-b border-border/20 pb-2">
                        <span className="text-sm font-medium truncate pr-2">{p.name}</span>
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-500">
                          {p.stock} unid.
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Quick POS Access */}
            <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg flex flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Punto de Venta</h2>
              <p className="text-sm text-muted-foreground mb-6">Escanea productos y registra ventas de forma rápida.</p>
              <Link href="/dashboard/pos" className="w-full rounded-lg gradient-primary px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110">
                Abrir POS
              </Link>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

