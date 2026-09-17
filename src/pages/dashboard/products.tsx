import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { alertMessage, toastSuccess, confirmAction } from '@/lib/alerts';
import {
  Package,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  AlertCircle,
  Upload,
  DownloadCloud,
  CalendarClock,
  Scale,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  barcode: string | null;
  createdAt: string;
  expirationDate: string | null;
  soldByWeight: boolean;
}

const DAYS_UNTIL_EXPIRY_WARNING = 7;

function daysUntil(dateStr: string): number {
  const diffMs = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '', imageUrl: '', barcode: '',
    expirationDate: '', soldByWeight: false,
  });
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'soon' | 'expired'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchProducts = async (bId: string) => {
    try {
      const res = await fetch('/api/products', {
        headers: { 'x-business-id': bId },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Error fetching products', e);
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
          fetchProducts(business.id);
        }
      } catch (e) {
        console.error('Error fetching business info', e);
      }
    };
    init();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm({
      name: '', description: '', price: '', stock: '', imageUrl: '', barcode: '',
      expirationDate: '', soldByWeight: false,
    });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      stock: String(product.stock),
      imageUrl: product.imageUrl || '',
      barcode: product.barcode || '',
      expirationDate: product.expirationDate ? product.expirationDate.split('T')[0] : '',
      soldByWeight: product.soldByWeight,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price) || 0,
        stock: parseFloat(form.stock) || 0,
        imageUrl: form.imageUrl || null,
        barcode: form.barcode || null,
        expirationDate: form.expirationDate || null,
        soldByWeight: form.soldByWeight,
      };

      if (editingProduct) {
        await fetch(`/api/products?id=${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      fetchProducts(businessId);
    } catch (e) {
      console.error('Error saving product', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId) return;
    if (!(await confirmAction('¿Estás seguro de eliminar este producto?', 'Sí, eliminar'))) return;
    try {
      await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-business-id': businessId },
      });
      fetchProducts(businessId);
    } catch (e) {
      console.error('Error deleting product', e);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
          alertMessage('El archivo CSV debe tener al menos una cabecera y una fila de datos', 'warning');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const products = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((h, i) => {
            obj[h] = values[i];
          });
          return obj;
        });

        const res = await fetch('/api/import/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
          body: JSON.stringify({ products }),
        });

        if (res.ok) {
          const data = await res.json();
          toastSuccess(`¡Se importaron ${data.count} productos exitosamente!`);
          fetchProducts(businessId);
          setShowImportModal(false);
        } else {
          alertMessage('Error importando productos');
        }
      } catch (err) {
        console.error(err);
        alertMessage('Error procesando el archivo CSV. Asegúrese de que el formato sea correcto.');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,name,description,price,stock,barcode,imageUrl\nProducto Ejemplo,Descripción genial,99.99,10,123456789,https://ejemplo.com/img.jpg";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plantilla-productos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (stockFilter === 'low' && !(Number(p.stock) > 0 && Number(p.stock) <= 20)) return false;
    if (stockFilter === 'out' && Number(p.stock) > 0) return false;

    if (expiryFilter !== 'all') {
      if (!p.expirationDate) return false;
      const days = daysUntil(p.expirationDate);
      if (expiryFilter === 'expired' && days >= 0) return false;
      if (expiryFilter === 'soon' && (days < 0 || days > DAYS_UNTIL_EXPIRY_WARNING)) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, stockFilter, expiryFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="mt-1 text-muted-foreground">Gestiona el inventario de tu negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nuevo producto
          </button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, descripción o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
          />
        </div>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
          className="h-10 rounded-lg border border-input bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        >
          <option value="all">Todo el stock</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
        </select>
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value as typeof expiryFilter)}
          className="h-10 rounded-lg border border-input bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        >
          <option value="all">Todos los vencimientos</option>
          <option value="soon">Por vencer</option>
          <option value="expired">Vencidos</option>
        </select>
        {(searchQuery || stockFilter !== 'all' || expiryFilter !== 'all') && (
          <button
            onClick={() => { setSearchQuery(''); setStockFilter('all'); setExpiryFilter('all'); }}
            className="h-10 whitespace-nowrap rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Producto</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Descripción</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Precio</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Stock</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="mt-3 text-sm">Cargando productos...</p>
                  </div>
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <Package className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">
                      {products.length === 0 ? 'No hay productos registrados' : 'Ningún producto coincide con la búsqueda/filtros'}
                    </p>
                    <p className="text-xs">
                      {products.length === 0 ? 'Haz clic en "Nuevo producto" para agregar uno' : 'Probá con otros términos o limpiá los filtros'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product, i) => (
                <tr
                  key={product.id}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium flex items-center gap-1.5">
                      {product.name}
                      {product.soldByWeight && (
                        <span title="Se vende por peso">
                          <Scale className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                    {product.barcode && (
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{product.barcode}</div>
                    )}
                    {product.expirationDate && (() => {
                      const days = daysUntil(product.expirationDate);
                      if (days > DAYS_UNTIL_EXPIRY_WARNING) return null;
                      return (
                        <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${days < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                          <CalendarClock className="h-3 w-3" />
                          {days < 0
                            ? `Vencido hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`
                            : days === 0
                            ? 'Vence hoy'
                            : `Vence en ${days} día${days === 1 ? '' : 's'}`}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{product.description || '—'}</td>
                  <td className="px-6 py-4 text-right font-mono">
                    ${Number(product.price).toFixed(2)}{product.soldByWeight && <span className="text-xs text-muted-foreground">/kg</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        Number(product.stock) <= 5
                          ? 'bg-red-500/15 text-red-400'
                          : Number(product.stock) <= 20
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {Number(product.stock) <= 5 && <AlertCircle className="h-3 w-3" />}
                      {product.soldByWeight ? `${Number(product.stock).toFixed(3)} kg` : Number(product.stock)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
                      >
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
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
        {!loading && filteredProducts.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredProducts.length)} de {filteredProducts.length} producto{filteredProducts.length === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col animate-slide-up rounded-2xl border border-border/50 bg-card shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Nombre *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="Coca-Cola 500ml" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Descripción</label>
                    <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="Bebida gaseosa" />
                  </div>
                </div>

                <ImageUploadField
                  label="Imagen del Producto (Opcional)"
                  value={form.imageUrl}
                  onChange={(url) => setForm({ ...form, imageUrl: url })}
                  businessId={businessId}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Código de Barras <span className="text-xs font-normal text-muted-foreground">(EAN13, etc.)</span>
                    </label>
                    <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm font-mono transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="7501000000000" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Vencimiento (Opcional)
                    </label>
                    <input
                      type="date"
                      value={form.expirationDate}
                      onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                      className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{form.soldByWeight ? 'Precio por Kg' : 'Precio'}</label>
                    <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{form.soldByWeight ? 'Stock (Kg)' : 'Stock'}</label>
                    <input type="number" step={form.soldByWeight ? '0.001' : '1'} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="0" />
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.soldByWeight}
                    onChange={(e) => setForm({ ...form, soldByWeight: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">Se vende por peso (Kg) — ej: quesos, fiambres, carnes</span>
                </label>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-border/50 px-6 py-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium transition-all duration-200 hover:bg-accent">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg gradient-primary text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    editingProduct ? 'Guardar cambios' : 'Crear producto'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !importing && setShowImportModal(false)} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Importar Productos
              </h2>
              <button onClick={() => !importing && setShowImportModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <h3 className="font-semibold text-sm mb-2">1. Descarga la plantilla</h3>
                <p className="text-sm text-muted-foreground mb-4">Completa el archivo con tus productos respetando el formato de las columnas.</p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 w-full justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  <DownloadCloud className="h-4 w-4" />
                  Descargar Plantilla CSV
                </button>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <h3 className="font-semibold text-sm mb-2">2. Sube el archivo completado</h3>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImportCSV}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {importing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Upload className="h-4 w-4" />}
                  {importing ? 'Procesando...' : 'Seleccionar Archivo CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
