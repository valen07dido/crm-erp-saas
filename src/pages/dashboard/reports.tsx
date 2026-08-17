import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Package, Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface Transaction {
  id: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
}

interface AdvancedReports {
  topProducts: { id: string; name: string; quantity: number; revenue: number }[];
  topClients: { id: string; name: string; purchases: number; spent: number }[];
}

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedReports | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async (bId: string) => {
    try {
      const [transRes, advRes] = await Promise.all([
        fetch('/api/transactions', { headers: { 'x-business-id': bId } }),
        fetch('/api/reports/advanced', { headers: { 'x-business-id': bId } })
      ]);
      
      if (transRes.ok) {
        setTransactions(await transRes.json());
      }
      if (advRes.ok) {
        setAdvanced(await advRes.json());
      }
    } catch (e) {
      console.error('Error fetching reports', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const { business } = await meRes.json();
          fetchTransactions(business.id);
        }
      } catch (e) {
        console.error('Error fetching business info', e);
      }
    };
    init();
  }, []);

  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = totalIncome - totalExpense;

  const chartData = useMemo(() => {
    // Agrupar transacciones por fecha (MM/DD/YYYY)
    const grouped = transactions.reduce((acc, curr) => {
      const dateStr = new Date(curr.date).toLocaleDateString();
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, Ingresos: 0, Gastos: 0 };
      }
      if (curr.type === 'INCOME') {
        acc[dateStr].Ingresos += Number(curr.amount);
      } else {
        acc[dateStr].Gastos += Number(curr.amount);
      }
      return acc;
    }, {} as Record<string, { date: string, Ingresos: number, Gastos: number }>);

    // Convertir a array y ordenar por fecha
    return Object.values(grouped).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reportes y Estadísticas</h1>
        <p className="mt-1 text-muted-foreground">Resumen financiero de tu negocio</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Ingresos Card */}
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Ingresos</p>
                <h3 className="text-2xl font-bold text-emerald-500">${totalIncome.toFixed(2)}</h3>
              </div>
            </div>
          </div>

          {/* Gastos Card */}
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                <TrendingDown className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Gastos</p>
                <h3 className="text-2xl font-bold text-red-500">${totalExpense.toFixed(2)}</h3>
              </div>
            </div>
          </div>

          {/* Balance Card */}
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${balance >= 0 ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'}`}>
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Balance Actual</p>
                <h3 className={`text-2xl font-bold ${balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                  ${balance.toFixed(2)}
                </h3>
              </div>
            </div>
          </div>
          
          {/* Chart Section */}
          <div className="col-span-1 rounded-xl border border-border/50 bg-card p-6 shadow-lg md:col-span-3">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Flujo de Caja Histórico</h3>
            </div>
            
            {chartData.length > 0 ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }} 
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(220, 20%, 14%)', 
                        borderRadius: '12px', 
                        border: '1px solid hsl(220, 13%, 22%)',
                        padding: '12px 16px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                      }}
                      labelStyle={{ color: 'hsl(220, 10%, 60%)', fontSize: '12px', marginBottom: '6px' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '13px', padding: '2px 0' }}
                      formatter={(value: any, name: any) => [
                        `$${Number(value).toFixed(2)}`,
                        name
                      ]}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/10">
                <p className="text-sm text-muted-foreground">No hay suficientes transacciones para generar un gráfico.</p>
              </div>
            )}
          </div>

          {/* Advanced Reports Section */}
          <div className="grid gap-6 md:grid-cols-2 md:col-span-3">
            {/* Top Products */}
            <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Top 5 Productos</h3>
              </div>
              {!advanced?.topProducts?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay datos suficientes</p>
              ) : (
                <ul className="space-y-4">
                  {advanced.topProducts.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <p className="font-medium text-sm">{p.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-primary">${p.revenue.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{p.quantity} unid.</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Top Clients */}
            <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <Users className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold text-lg">Mejores Clientes</h3>
              </div>
              {!advanced?.topClients?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay datos suficientes</p>
              ) : (
                <ul className="space-y-4">
                  {advanced.topClients.map((c, i) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-500">
                          {i + 1}
                        </span>
                        <p className="font-medium text-sm">{c.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-blue-500">${c.spent.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{c.purchases} compras</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
