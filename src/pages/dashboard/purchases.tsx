import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Truck, Plus, X, Search, PackageOpen, Download, FileUp, Trash2, Percent } from 'lucide-react';
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

interface ImportItem {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  cost: number;
  salePrice: number;
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

  // PDF invoice import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSupplier, setImportSupplier] = useState('');
  const [margin, setMargin] = useState(30);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const resetImportState = () => {
    setImportItems([]);
    setRawText('');
    setImportSupplier('');
    setMargin(30);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    setParsing(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch('/api/purchases/parse-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify({ fileBase64 }),
      });
      if (res.ok) {
        const data = await res.json();
        setRawText(data.rawText || '');
        const items: ImportItem[] = (data.items || []).map((it: any, idx: number) => ({
          id: `${Date.now()}-${idx}`,
          name: it.name,
          barcode: it.code || '',
          quantity: it.quantity,
          cost: it.cost,
          salePrice: Math.round(it.cost * (1 + margin / 100) * 100) / 100,
        }));
        setImportItems(items);
      } else {
        alert('No se pudo leer el PDF');
      }
    } catch (err) {
      console.error('Error parsing PDF', err);
      alert('Error procesando el PDF');
    } finally {
      setParsing(false);
    }
  };

  const handleMarginChange = (value: string) => {
    const m = parseFloat(value) || 0;
    setMargin(m);
    setImportItems(prev =>
      prev.map(item => ({ ...item, salePrice: Math.round(item.cost * (1 + m / 100) * 100) / 100 }))
    );
  };

  const updateImportItem = (id: string, field: keyof ImportItem, value: string) => {
    setImportItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (field === 'name' || field === 'barcode') {
          return { ...item, [field]: value };
        }
        const numValue = parseFloat(value) || 0;
        if (field === 'cost') {
          return { ...item, cost: numValue, salePrice: Math.round(numValue * (1 + margin / 100) * 100) / 100 };
        }
        return { ...item, [field]: numValue };
      })
    );
  };

  const addImportRow = () => {
    setImportItems(prev => [
      ...prev,
      { id: `manual-${Date.now()}`, name: '', barcode: '', quantity: 1, cost: 0, salePrice: 0 },
    ]);
  };

  const removeImportRow = (id: string) => {
    setImportItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmImport = async () => {
    if (!businessId || importItems.length === 0) return;
    setImportSaving(true);
    try {
      const payload = {
        supplierId: importSupplier || null,
        items: importItems.map(({ name, barcode, quantity, cost, salePrice }) => ({
          name,
          barcode: barcode || null,
          quantity,
          cost,
          salePrice,
        })),
      };
      const res = await fetch('/api/purchases/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setShowImportModal(false);
        resetImportState();
        fetchData(businessId);
        alert(`Se actualizaron ${data.productsUpdated} productos correctamente.`);
      } else {
        const err = await res.json();
        alert(err.error || 'Error al ingresar la mercadería');
      }
    } catch (e) {
      console.error('Error confirming import', e);
    } finally {
      setImportSaving(false);
    }
  };

  const importTotals = importItems.reduce(
    (acc, item) => ({
      cost: acc.cost + item.cost * item.quantity,
      sale: acc.sale + item.salePrice * item.quantity,
    }),
    { cost: 0, sale: 0 }
  );

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
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <FileUp className="h-4 w-4" />
            Importar Factura PDF
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

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (importSaving) return;
              setShowImportModal(false);
              resetImportState();
            }}
          />
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Importar Factura de Proveedor (PDF)</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Subí el PDF, ajustá el margen de ganancia y revisá los datos antes de confirmar
                </p>
              </div>
              <button
                onClick={() => {
                  if (importSaving) return;
                  setShowImportModal(false);
                  resetImportState();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {importItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 p-10 text-center">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handlePdfUpload}
                />
                <FileUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                <p className="mb-4 text-sm text-muted-foreground">
                  Seleccioná el PDF de la factura o lista de precios del proveedor
                </p>
                <button
                  type="button"
                  disabled={parsing}
                  onClick={() => fileInputRef.current?.click()}
                  className="mx-auto flex items-center justify-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {parsing ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {parsing ? 'Analizando PDF...' : 'Seleccionar PDF'}
                </button>
                <button
                  type="button"
                  onClick={addImportRow}
                  className="mx-auto mt-4 block text-sm text-primary hover:underline"
                >
                  o cargar productos manualmente
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {rawText && importItems.length === 0 && (
                  <p className="text-sm text-amber-400">
                    No se detectaron productos automáticamente. Podés revisar el texto extraído abajo y cargar los productos a mano.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Proveedor (Opcional)</label>
                    <select
                      value={importSupplier}
                      onChange={(e) => setImportSupplier(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Proveedor General</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Margen de Ganancia</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={margin}
                        onChange={(e) => handleMarginChange(e.target.value)}
                        className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 pr-9 text-sm focus:ring-2 focus:ring-ring"
                      />
                      <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Producto</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cód. Barra</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cant.</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Costo</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Precio Venta</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {importItems.map(item => (
                        <tr key={item.id} className="border-b border-border/30">
                          <td className="px-3 py-2">
                            <input
                              value={item.name}
                              onChange={(e) => updateImportItem(item.id, 'name', e.target.value)}
                              placeholder="Nombre del producto"
                              className="h-8 w-full rounded border border-input bg-background px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={item.barcode}
                              onChange={(e) => updateImportItem(item.id, 'barcode', e.target.value)}
                              placeholder="Opcional"
                              className="h-8 w-28 rounded border border-input bg-background px-2 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateImportItem(item.id, 'quantity', e.target.value)}
                              className="h-8 w-16 rounded border border-input bg-background px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.cost}
                              onChange={(e) => updateImportItem(item.id, 'cost', e.target.value)}
                              className="h-8 w-24 rounded border border-input bg-background px-2 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.salePrice}
                              onChange={(e) => updateImportItem(item.id, 'salePrice', e.target.value)}
                              className="h-8 w-24 rounded border border-input bg-background px-2 text-right font-semibold"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => removeImportRow(item.id)} className="text-red-400 hover:text-red-300">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={addImportRow} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <Plus className="h-4 w-4" />
                    Agregar producto
                  </button>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Costo total: ${importTotals.cost.toFixed(2)}</p>
                    <p className="font-semibold text-primary">Valor de venta: ${importTotals.sale.toFixed(2)}</p>
                  </div>
                </div>

                {rawText && (
                  <details className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground">Ver texto extraído del PDF</summary>
                    <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">{rawText}</pre>
                  </details>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetImportState}
                    className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium hover:bg-accent"
                  >
                    Cargar otro PDF
                  </button>
                  <button
                    type="button"
                    disabled={importSaving || importItems.length === 0}
                    onClick={handleConfirmImport}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg gradient-primary text-sm font-medium text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {importSaving ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      'Confirmar e Ingresar Mercadería'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
