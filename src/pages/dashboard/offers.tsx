import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { exportToCSV } from '@/lib/export';
import { alertMessage, confirmAction } from '@/lib/alerts';
import {
  Gift,
  Plus,
  Edit3,
  Trash2,
  X,
  Search,
  Download,
  Package,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface ComboItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

interface Combo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  barcode: string | null;
  isActive: boolean;
  items: ComboItem[];
}

interface DraftItem {
  productId: string;
  quantity: number;
  product?: Product;
}

export default function OffersPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    barcode: '',
    isActive: true,
  });
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const fetchData = async (bId: string) => {
    try {
      const [comboRes, prodRes] = await Promise.all([
        fetch('/api/combos', { headers: { 'x-business-id': bId } }),
        fetch('/api/products', { headers: { 'x-business-id': bId } }),
      ]);
      if (comboRes.ok) setCombos(await comboRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (e) {
      console.error('Error fetching offers', e);
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
          fetchData(business.id);
        }
      } catch (e) {
        console.error('Error fetching business info', e);
      }
    };
    init();
  }, []);

  const openCreateModal = () => {
    setEditingCombo(null);
    setForm({ name: '', description: '', price: '', imageUrl: '', barcode: '', isActive: true });
    setDraftItems([]);
    setShowModal(true);
  };

  const openEditModal = (combo: Combo) => {
    setEditingCombo(combo);
    setForm({
      name: combo.name,
      description: combo.description || '',
      price: String(combo.price),
      imageUrl: combo.imageUrl || '',
      barcode: combo.barcode || '',
      isActive: combo.isActive,
    });
    setDraftItems(combo.items.map((it) => ({ productId: it.productId, quantity: it.quantity, product: it.product })));
    setShowModal(true);
  };

  const addDraftItem = (productId: string) => {
    if (!productId) return;
    if (draftItems.some((it) => it.productId === productId)) return;
    const product = products.find((p) => p.id === productId);
    setDraftItems((prev) => [...prev, { productId, quantity: 1, product }]);
  };

  const updateDraftQuantity = (productId: string, quantity: string) => {
    const q = Math.max(1, parseInt(quantity, 10) || 1);
    setDraftItems((prev) => prev.map((it) => (it.productId === productId ? { ...it, quantity: q } : it)));
  };

  const removeDraftItem = (productId: string) => {
    setDraftItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    if (draftItems.length < 2) {
      alertMessage('Un combo necesita al menos 2 productos', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price) || 0,
        imageUrl: form.imageUrl || null,
        barcode: form.barcode || null,
        isActive: form.isActive,
        items: draftItems.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      };

      if (editingCombo) {
        await fetch(`/api/combos?id=${editingCombo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/combos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      fetchData(businessId);
    } catch (e) {
      console.error('Error saving combo', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId) return;
    if (!(await confirmAction('¿Estás seguro de eliminar esta oferta?', 'Sí, eliminar'))) return;
    try {
      await fetch(`/api/combos?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-business-id': businessId },
      });
      fetchData(businessId);
    } catch (e) {
      console.error('Error deleting combo', e);
    }
  };

  const filteredCombos = combos.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ofertas</h1>
          <p className="mt-1 text-muted-foreground">Armá combos de productos a un precio fijo</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const dataToExport = filteredCombos.map((c) => ({
                Nombre: c.name,
                Precio: c.price,
                Productos: c.items.map((it) => `${it.quantity}x ${it.product.name}`).join(' + '),
                Estado: c.isActive ? 'Activo' : 'Inactivo',
              }));
              exportToCSV(dataToExport, 'ofertas');
            }}
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
            Nueva Oferta
          </button>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar oferta..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Oferta</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Incluye</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Precio</th>
              <th className="px-6 py-4 text-center font-medium text-muted-foreground">Estado</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="mt-3 text-sm">Cargando ofertas...</p>
                  </div>
                </td>
              </tr>
            ) : filteredCombos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <Gift className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">No hay ofertas creadas</p>
                    <p className="text-xs">Armá un combo de productos a precio fijo</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCombos.map((combo, i) => (
                <tr
                  key={combo.id}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {combo.imageUrl ? (
                        <img src={combo.imageUrl} alt={combo.name} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Gift className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{combo.name}</p>
                        {combo.barcode && <p className="font-mono text-xs text-muted-foreground">{combo.barcode}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {combo.items.map((it) => `${it.quantity}x ${it.product.name}`).join(' + ')}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-primary">
                    ${Number(combo.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        combo.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {combo.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(combo)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
                      >
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(combo.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
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
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingCombo ? 'Editar oferta' : 'Nueva oferta'}</h2>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nombre *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Combo Familiar"
                  className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Descripción</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="3 gaseosas + 1 papas fritas"
                  className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Precio de la oferta *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                    placeholder="0.00"
                    className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Código de Barra</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Opcional"
                    className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm font-mono transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
                  />
                </div>
              </div>

              <ImageUploadField
                label="Imagen de la Oferta (Opcional)"
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                businessId={businessId}
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm font-medium">Oferta activa (visible en el Punto de Venta)</label>
              </div>

              <div className="rounded-lg border border-border/50 bg-background/50 p-4">
                <h3 className="mb-3 text-sm font-semibold">Productos que incluye *</h3>
                <select
                  onChange={(e) => { addDraftItem(e.target.value); e.target.value = ''; }}
                  value=""
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Agregar un producto...</option>
                  {products.filter((p) => !draftItems.some((it) => it.productId === p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                {draftItems.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Agregá al menos 2 productos.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {draftItems.map((it) => (
                      <li key={it.productId} className="flex items-center gap-3 text-sm">
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{it.product?.name}</span>
                        <label className="text-xs text-muted-foreground">Cant:</label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => updateDraftQuantity(it.productId, e.target.value)}
                          className="h-8 w-16 rounded border border-input bg-background px-2 text-right"
                        />
                        <button type="button" onClick={() => removeDraftItem(it.productId)} className="text-red-400 hover:text-red-300">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium transition-all duration-200 hover:bg-accent">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg gradient-primary text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    editingCombo ? 'Guardar cambios' : 'Crear oferta'
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
