import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Shield, Settings, Users, Store, CheckCircle, XCircle, Calendar, RefreshCw, Save, Plus, X, Dices, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { PLAN_LABELS } from '@/lib/plans';
import { alertMessage, toastSuccess } from '@/lib/alerts';

interface BusinessUserRow {
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
  };
}

interface Business {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  planName: string;
  planExpiresAt: string | null;
  createdAt: string;
  businessUsers: BusinessUserRow[];
  _count: {
    businessUsers: number;
    products: number;
    sales: number;
  };
}

export default function SuperAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);

  const [form, setForm] = useState({
    planName: '',
    planExpiresAt: '',
    isActive: true,
  });
  const [usernameEdits, setUsernameEdits] = useState<Record<string, string>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const emptyCreateForm = {
    businessName: '',
    name: '',
    username: '',
    email: '',
    password: '',
    planName: 'BASIC',
    planExpiresAt: '',
    isActive: true,
  };
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      if (session.user?.email !== 'valendido69@gmail.com') {
        router.push('/dashboard');
      } else {
        fetchBusinesses();
      }
    }
  }, [status, router, session]);

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/businesses');
      if (res.ok) {
        setBusinesses(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (b: Business) => {
    setEditingBusiness(b);
    setForm({
      planName: b.planName,
      planExpiresAt: b.planExpiresAt ? new Date(b.planExpiresAt).toISOString().split('T')[0] : '',
      isActive: b.isActive,
    });
    setUsernameEdits(
      Object.fromEntries(b.businessUsers.map((bu) => [bu.user.id, bu.user.username || '']))
    );
  };

  const handleSaveUsername = async (userId: string) => {
    setSavingUserId(userId);
    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, username: usernameEdits[userId] }),
      });
      if (res.ok) {
        toastSuccess('Usuario actualizado');
        fetchBusinesses();
      } else {
        const data = await res.json();
        alertMessage(data.error || 'Error al actualizar el usuario');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;

    try {
      const res = await fetch('/api/superadmin/businesses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBusiness.id,
          planName: form.planName,
          planExpiresAt: form.planExpiresAt || null,
          isActive: form.isActive,
        }),
      });

      if (res.ok) {
        setEditingBusiness(null);
        fetchBusinesses();
        toastSuccess('Negocio actualizado');
      } else {
        alertMessage('Error al actualizar el negocio');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setCreateForm((f) => ({ ...f, password: pass }));
    setShowCreatePassword(true);
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/superadmin/create-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          planExpiresAt: createForm.planExpiresAt || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(`Negocio "${createForm.businessName}" creado — usuario: ${createForm.username}`);
        setShowCreateModal(false);
        setCreateForm(emptyCreateForm);
        setShowCreatePassword(false);
        fetchBusinesses();
      } else {
        alertMessage(data.error || 'Error al crear el negocio');
      }
    } catch (error) {
      console.error(error);
      alertMessage('Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary/30 border-t-primary" />
      </div>
    );
  }

  const activeBusinesses = businesses.filter(b => b.isActive).length;
  const totalUsers = businesses.reduce((acc, curr) => acc + curr._count.businessUsers, 0);

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>Super Admin | SaaS</title>
      </Head>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-xl font-bold text-primary">
            <Shield className="h-6 w-6" />
            Super Admin
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Volver a mi Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        {/* Global Stats */}
        <div className="mb-8 grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Store className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-muted-foreground">Comercios Activos</h3>
            </div>
            <p className="text-3xl font-bold">{activeBusinesses} <span className="text-lg text-muted-foreground font-normal">/ {businesses.length}</span></p>
          </div>
          
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-muted-foreground">Total Usuarios</h3>
            </div>
            <p className="text-3xl font-bold">{totalUsers}</p>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold text-muted-foreground">Estado del Sistema</h3>
            </div>
            <p className="text-3xl font-bold text-emerald-500">Online</p>
          </div>
        </div>

        {/* Business List */}
        <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 p-6">
            <h2 className="text-lg font-bold">Gestión de Inquilinos (Tenants)</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCreateForm(emptyCreateForm); setShowCreatePassword(false); setShowCreateModal(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:brightness-110 transition-all"
              >
                <Plus className="h-4 w-4" />
                Nuevo Negocio
              </button>
              <button onClick={fetchBusinesses} className="rounded-lg p-2 hover:bg-accent transition-colors" title="Actualizar">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Comercio</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Plan Actual</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Vencimiento</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Métricas</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Estado</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {businesses.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold">{b.name}</p>
                      <p className="text-xs text-muted-foreground">/{b.slug}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                        {PLAN_LABELS[b.planName] || b.planName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {b.planExpiresAt ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(b.planExpiresAt).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Sin vencimiento</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      <div>{b._count.businessUsers} usuarios</div>
                      <div>{b._count.products} productos</div>
                      <div>{b._count.sales} ventas</div>
                    </td>
                    <td className="px-6 py-4">
                      {b.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-medium text-xs">
                          <CheckCircle className="h-4 w-4" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-medium text-xs">
                          <XCircle className="h-4 w-4" /> Suspendido
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(b)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editingBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingBusiness(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold mb-4">Gestionar Plan: {editingBusiness.name}</h2>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del Plan</label>
                <select
                  value={form.planName}
                  onChange={(e) => setForm({ ...form, planName: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="BASIC">{PLAN_LABELS.BASIC} (BASIC)</option>
                  <option value="PRO">{PLAN_LABELS.PRO} (PRO)</option>
                  <option value="ENTERPRISE">{PLAN_LABELS.ENTERPRISE} (ENTERPRISE)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Fecha de Vencimiento (Opcional)</label>
                <input
                  type="date"
                  value={form.planExpiresAt}
                  onChange={(e) => setForm({ ...form, planExpiresAt: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">Si dejas esto en blanco, la cuenta no expirará automáticamente.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">Cuenta Activa (Suspendida si se desmarca)</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/50 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingBusiness(null)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>

            {editingBusiness.businessUsers.length > 0 && (
              <div className="mt-6 border-t border-border/50 pt-4">
                <h3 className="mb-3 text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Usuarios de este comercio
                </h3>
                <div className="space-y-3">
                  {editingBusiness.businessUsers.map(({ user }) => (
                    <div key={user.id} className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          type="text"
                          value={usernameEdits[user.id] ?? ''}
                          onChange={(e) => setUsernameEdits({ ...usernameEdits, [user.id]: e.target.value.toLowerCase() })}
                          placeholder="Sin usuario asignado"
                          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          disabled={savingUserId === user.id}
                          onClick={() => handleSaveUsername(user.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          {savingUserId === user.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Guardar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Business Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !creating && setShowCreateModal(false)} />
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Dar de alta un negocio</h2>
              <button onClick={() => setShowCreateModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBusiness} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del negocio</label>
                <input
                  type="text"
                  required
                  value={createForm.businessName}
                  onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                  placeholder="Almacén Cris"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre del administrador</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Juan Pérez"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Usuario</label>
                  <input
                    type="text"
                    required
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase() })}
                    placeholder="juan_perez"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value.toLowerCase() })}
                  placeholder="juan@email.com"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contraseña</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCreatePassword((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    title="Generar contraseña"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <Dices className="h-3.5 w-3.5" />
                    Generar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Plan</label>
                  <select
                    value={createForm.planName}
                    onChange={(e) => setCreateForm({ ...createForm, planName: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  >
                    <option value="BASIC">{PLAN_LABELS.BASIC} (BASIC)</option>
                    <option value="PRO">{PLAN_LABELS.PRO} (PRO)</option>
                    <option value="ENTERPRISE">{PLAN_LABELS.ENTERPRISE} (ENTERPRISE)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vencimiento (Opcional)</label>
                  <input
                    type="date"
                    value={createForm.planExpiresAt}
                    onChange={(e) => setCreateForm({ ...createForm, planExpiresAt: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createIsActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="createIsActive" className="text-sm font-medium">Cuenta activa desde el alta</label>
              </div>

              <div className="flex gap-3 border-t border-border/50 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {creating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    'Crear negocio'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
