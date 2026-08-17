import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreditCard, Plus, Search, X, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/export';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string | null;
  date: string;
}

export default function ExpensesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [form, setForm] = useState({ amount: '', description: '', category: '' });

  const fetchTransactions = async (bId: string) => {
    try {
      const res = await fetch('/api/transactions?type=EXPENSE', {
        headers: { 'x-business-id': bId },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error('Error fetching transactions', e);
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
          setBusinessId(business.id);
          fetchTransactions(business.id);
        }
      } catch (e) {
        console.error('Error fetching business info', e);
      }
    };
    init();
  }, []);

  const openCreateModal = () => {
    setForm({ amount: '', description: '', category: 'Gastos Operativos' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      const payload = {
        type: 'EXPENSE',
        amount: parseFloat(form.amount),
        description: form.description,
        category: form.category,
      };

      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify(payload),
      });

      setShowModal(false);
      fetchTransactions(businessId);
    } catch (e) {
      console.error('Error saving transaction', e);
    } finally {
      setSaving(false);
    }
  };

  const filteredTransactions = transactions.filter((t) =>
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalExpense = transactions.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gastos</h1>
          <p className="mt-1 text-muted-foreground">Control de salidas de dinero</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-lg bg-red-500/10 px-4 py-2 border border-red-500/20">
            <span className="text-sm font-medium text-red-600 dark:text-red-400">Total Gastos:</span>
            <span className="ml-2 font-bold text-red-700 dark:text-red-300">${totalExpense.toFixed(2)}</span>
          </div>
          <button
            onClick={() => exportToCSV(filteredTransactions, 'gastos')}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Registrar Gasto
          </button>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar gasto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Fecha</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Descripción</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Categoría</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Monto</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="mt-3 text-sm">Cargando movimientos...</p>
                  </div>
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <CreditCard className="mb-3 h-12 w-12 opacity-30 text-red-500" />
                    <p className="text-sm">No hay gastos registrados</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, i) => (
                <tr
                  key={tx.id}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-4 text-muted-foreground">{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  <td className="px-6 py-4 font-medium">{tx.description}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">
                      {tx.category || 'Varios'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-red-500">
                    -${Number(tx.amount).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registrar Gasto Manual</h2>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="flex h-10 w-full rounded-lg border border-input bg-background/50 pl-8 pr-3 text-sm focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Descripción *</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" placeholder="Ej: Pago de luz" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Categoría</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring">
                  <option value="Gastos Operativos">Gastos Operativos</option>
                  <option value="Impuestos">Impuestos</option>
                  <option value="Servicios Publicos">Servicios Públicos</option>
                  <option value="Sueldos">Sueldos</option>
                  <option value="Varios">Varios</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border hover:bg-accent">Cancelar</button>
                <button type="submit" disabled={saving} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Guardar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
