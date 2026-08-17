import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
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
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', imageUrl: '', barcode: '' });
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    setForm({ name: '', description: '', price: '', stock: '', imageUrl: '', barcode: '' });
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
        stock: parseInt(form.stock) || 0,
        imageUrl: form.imageUrl || null,
        barcode: form.barcode || null,
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
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
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
          alert('El archivo CSV debe tener al menos una cabecera y una fila de datos');
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
          alert(`¡Se importaron ${data.count} productos exitosamente!`);
          fetchProducts(businessId);
          setShowImportModal(false);
        } else {
          alert('Error importando productos');
        }
      } catch (err) {
        console.error(err);
        alert('Error procesando el archivo CSV. Asegúrese de que el formato sea correcto.');
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

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar producto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
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
                    <p className="text-sm">No hay productos registrados</p>
                    <p className="text-xs">Haz clic en "Nuevo producto" para agregar uno</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredProducts.map((product, i) => (
                <tr
                  key={product.id}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium">{product.name}</div>
                    {product.barcode && (
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{product.barcode}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{product.description || '—'}</td>
                  <td className="px-6 py-4 text-right font-mono">${Number(product.price).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        product.stock <= 5
                          ? 'bg-red-500/15 text-red-400'
                          : product.stock <= 20
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {product.stock <= 5 && <AlertCircle className="h-3 w-3" />}
                      {product.stock}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="Coca-Cola 500ml" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Descripción</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="Bebida gaseosa" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">URL de Imagen (Opcional)</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="https://ejemplo.com/imagen.jpg" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium flex items-center gap-2">
                  Código de Barras
                  <span className="text-xs font-normal text-muted-foreground">(EAN13, Code128, etc.)</span>
                </label>
                <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm font-mono transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="7501000000000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Precio</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="0.00" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" placeholder="0" />
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
