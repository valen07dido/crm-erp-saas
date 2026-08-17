import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Truck, Plus, X, Search, PackageOpen, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/export';

interface Purchase {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  supplier?: { name: string };
  items: any[];
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Supplier {
  id: string;
  name: string;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<{ productId: string; quantity: number; price: number; product?: Product }[]>([]);

  const fetchData = async (bId: string) => {
    try {
      const [purchasesRes, productsRes, suppliersRes] = await Promise.all([
        fetch('/api/purchases', { headers: { 'x-business-id': bId } }),
        fetch('/api/products', { headers: { 'x-business-id': bId } }),
        fetch('/api/suppliers', { headers: { 'x-business-id': bId } }),
      ]);
      
      if (purchasesRes.ok) setPurchases(await purchasesRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    } catch (e) {
      console.error('Error fetching data', e);
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

  const handleAddToCart = (productId: string) => {
    if (!productId) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      // For purchases, default cost price could be product price, but editable later
      return [...prev, { productId, quantity: 1, price: product.price, product }];
    });
  };

  const updateCartItem = (productId: string, field: 'quantity' | 'price', value: string) => {
    const numValue = parseFloat(value) || 0;
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, [field]: numValue } : item));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || cart.length === 0) {
      alert('Debe agregar al menos un producto');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplierId: selectedSupplier || null,
        items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price })),
      };

      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify(payload),
      });

      setShowModal(false);
      setCart([]);
      setSelectedSupplier('');
      fetchData(businessId);
    } catch (e) {
      console.error('Error saving purchase', e);
    } finally {
      setSaving(false);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const filteredPurchases = purchases.filter((p) =>
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="mt-1 text-muted-foreground">Registra el abastecimiento e incrementa el stock</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const dataToExport = filteredPurchases.map(p => ({
                ID: p.id.slice(0, 8),
                Fecha: new Date(p.createdAt).toLocaleDateString(),
                Proveedor: p.supplier?.name || 'Proveedor General',
                Total: p.total,
                Estado: p.status
              }));
              exportToCSV(dataToExport, 'compras');
            }}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Registrar Compra
          </button>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por ID o proveedor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">ID Compra</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Fecha</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Proveedor</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="mt-3 text-sm">Cargando compras...</p>
                  </div>
                </td>
              </tr>
            ) : filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <PackageOpen className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">No hay compras registradas</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPurchases.map((purchase, i) => (
                <tr
                  key={purchase.id}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-4 font-mono font-medium">#{purchase.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(purchase.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-muted-foreground">{purchase.supplier?.name || 'Proveedor General'}</td>
                  <td className="px-6 py-4 text-right font-bold text-red-500">${Number(purchase.total).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-2xl animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registrar Nueva Compra</h2>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Proveedor (Opcional)</label>
                <select 
                  value={selectedSupplier} 
                  onChange={(e) => setSelectedSupplier(e.target.value)} 
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value="">Proveedor General</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Agregar Producto al Pedido</label>
                <select 
                  onChange={(e) => handleAddToCart(e.target.value)}
                  value=""
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Seleccione un producto para abastecer...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Shopping Cart List */}
              <div className="rounded-lg border border-border/50 bg-background/50 p-4">
                <h3 className="mb-3 font-semibold text-sm">Detalle de la Compra</h3>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay productos en la orden de compra.</p>
                ) : (
                  <ul className="space-y-3">
                    {cart.map(item => (
                      <li key={item.productId} className="flex items-center gap-4 text-sm">
                        <span className="flex-1 font-medium">{item.product?.name}</span>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">Cant:</label>
                          <input type="number" min="1" value={item.quantity} onChange={e => updateCartItem(item.productId, 'quantity', e.target.value)} className="h-8 w-16 rounded border border-input bg-background px-2 text-right" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">Costo Unit:</label>
                          <input type="number" step="0.01" value={item.price} onChange={e => updateCartItem(item.productId, 'price', e.target.value)} className="h-8 w-24 rounded border border-input bg-background px-2 text-right" />
                        </div>
                        <span className="w-20 text-right font-mono font-semibold">${(item.quantity * item.price).toFixed(2)}</span>
                        <button type="button" onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-300">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 border-t border-border pt-3 text-right font-bold text-lg text-primary">
                  Total a Pagar: ${calculateTotal().toFixed(2)}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border hover:bg-accent">Cancelar</button>
                <button type="submit" disabled={saving || cart.length === 0} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg gradient-primary text-white hover:brightness-110 disabled:opacity-50">
                  {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Registrar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
