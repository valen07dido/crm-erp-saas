import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { alertMessage, toastSuccess, confirmAction } from '@/lib/alerts';
import { UserCog, Plus, X, Trash2, ShieldCheck, ScanBarcode } from 'lucide-react';

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
  };
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', role: 'POS' });

  const fetchMembers = async (bId: string) => {
    try {
      const res = await fetch('/api/business-users', { headers: { 'x-business-id': bId } });
      if (res.ok) setMembers(await res.json());
      else if (res.status === 403) alertMessage('Solo un administrador puede ver esta sección', 'warning');
    } catch (e) {
      console.error('Error fetching team', e);
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
          fetchMembers(business.id);
        }
      } catch (e) {
        console.error('Error fetching business info', e);
      }
    };
    init();
  }, []);

  const openCreateModal = () => {
    setForm({ name: '', email: '', username: '', password: '', role: 'POS' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/business-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        fetchMembers(businessId);
        toastSuccess('Usuario creado correctamente');
      } else {
        const data = await res.json();
        alertMessage(data.error || 'Error al crear el usuario');
      }
    } catch (e) {
      console.error('Error creating team member', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    if (!businessId) return;
    try {
      const res = await fetch('/api/business-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify({ id, role }),
      });
      if (res.ok) {
        fetchMembers(businessId);
      } else {
        const data = await res.json();
        alertMessage(data.error || 'Error al cambiar el rol');
      }
    } catch (e) {
      console.error('Error updating role', e);
    }
  };

  const handleDelete = async (member: TeamMember) => {
    if (!businessId) return;
    if (!(await confirmAction(`¿Eliminar a ${member.user.name || member.user.email}?`, 'Sí, eliminar'))) return;
    try {
      const res = await fetch(`/api/business-users?id=${member.id}`, {
        method: 'DELETE',
        headers: { 'x-business-id': businessId },
      });
      if (res.ok) {
        fetchMembers(businessId);
      } else {
        const data = await res.json();
        alertMessage(data.error || 'Error al eliminar el usuario');
      }
    } catch (e) {
      console.error('Error deleting team member', e);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="mt-1 text-muted-foreground">Creá logins para tu equipo: administradores o solo Punto de Venta</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Usuario</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Rol</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                      <p className="mt-3 text-sm">Cargando usuarios...</p>
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <UserCog className="mb-3 h-12 w-12 opacity-30" />
                      <p className="text-sm">No hay usuarios adicionales</p>
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((member, i) => (
                  <tr
                    key={member.id}
                    className="border-b border-border/30 transition-colors hover:bg-muted/20 animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium">{member.user.name || 'Sin nombre'}</div>
                      {member.user.username && <div className="font-mono text-xs text-muted-foreground">@{member.user.username}</div>}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{member.user.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={member.user.id === currentUserId}
                        className="h-9 rounded-lg border border-input bg-background/50 px-2.5 text-sm disabled:opacity-50"
                      >
                        <option value="ADMIN">Administrador</option>
                        <option value="POS">Solo Punto de Venta</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={member.user.id === currentUserId}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10 disabled:opacity-30"
                        title={member.user.id === currentUserId ? 'No podés eliminarte a vos mismo' : 'Eliminar'}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nuevo usuario</h2>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nombre</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} required className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring" placeholder="juan@email.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Usuario</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring" placeholder="juan_perez" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Rol</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: 'POS' })}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-all ${form.role === 'POS' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'}`}
                  >
                    <ScanBarcode className="h-5 w-5" />
                    Solo Punto de Venta
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: 'ADMIN' })}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-all ${form.role === 'ADMIN' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'}`}
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Administrador
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium transition-all duration-200 hover:bg-accent">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg gradient-primary text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    'Crear usuario'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
