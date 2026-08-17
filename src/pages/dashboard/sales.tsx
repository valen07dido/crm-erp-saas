import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ShoppingCart, Plus, X, Search, Download, FileText } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Sale {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  client?: { name: string; email?: string; phone?: string; address?: string };
  items: any[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Client {
  id: string;
  name: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [selectedClient, setSelectedClient] = useState('');
  const [cart, setCart] = useState<{ productId: string; quantity: number; product?: Product }[]>([]);

  const fetchData = async (bId: string) => {
    try {
      const [salesRes, productsRes, clientsRes] = await Promise.all([
        fetch('/api/sales', { headers: { 'x-business-id': bId } }),
        fetch('/api/products', { headers: { 'x-business-id': bId } }),
        fetch('/api/clients', { headers: { 'x-business-id': bId } }),
      ]);
      
      if (salesRes.ok) setSales(await salesRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
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
    if (!product || product.stock <= 0) {
      alert('Producto sin stock o no encontrado');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert('No hay suficiente stock');
          return prev;
        }
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId, quantity: 1, product }];
    });
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
        clientId: selectedClient || null,
        items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
      };

      await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify(payload),
      });

      setShowModal(false);
      setCart([]);
      setSelectedClient('');
      fetchData(businessId);
    } catch (e) {
      console.error('Error saving sale', e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (saleId: string, newStatus: string) => {
    if (!businessId) return;
    try {
      const res = await fetch('/api/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify({ id: saleId, status: newStatus }),
      });
      if (res.ok) {
        fetchData(businessId);
      } else {
        alert('Error al actualizar el estado');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.product?.price || 0) * item.quantity, 0);
  };

  const generatePDF = (sale: Sale) => {
    const doc = new jsPDF();
    const date = new Date(sale.createdAt).toLocaleDateString();
    
    // Header
    doc.setFontSize(20);
    doc.text('Comprobante de Venta', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${date}`, 14, 30);
    doc.text(`ID Venta: #${sale.id.slice(0, 8)}`, 14, 35);
    
    // Client Info
    doc.setFontSize(12);
    doc.text('Datos del Cliente:', 14, 45);
    doc.setFontSize(10);
    doc.text(`Nombre: ${sale.client?.name || 'Consumidor Final'}`, 14, 52);
    if (sale.client?.email) doc.text(`Email: ${sale.client.email}`, 14, 57);
    if (sale.client?.phone) doc.text(`Teléfono: ${sale.client.phone}`, 14, 62);

    // Items Table
    const tableData = sale.items.map(item => [
      item.product.name,
      item.quantity.toString(),
      `$${Number(item.price).toFixed(2)}`,
      `$${(item.quantity * Number(item.price)).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] } // primary blue
    });

    // Total
    const finalY = (doc as any).lastAutoTable?.finalY || 75;
    doc.setFontSize(14);
    doc.text(`Total: $${Number(sale.total).toFixed(2)}`, 14, finalY + 10);

    doc.save(`Ticket_${sale.id.slice(0,8)}.pdf`);
  };

  const filteredSales = sales.filter((s) =>
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.client?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="mt-1 text-muted-foreground">Registra ventas y controla inventario</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const dataToExport = filteredSales.map(s => ({
                ID: s.id.slice(0, 8),
                Fecha: new Date(s.createdAt).toLocaleDateString(),
                Cliente: s.client?.name || 'Consumidor Final',
                Total: s.total,
                Estado: s.status
              }));
              exportToCSV(dataToExport, 'ventas');
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
            Nueva Venta
          </button>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por ID o cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">ID Venta</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Fecha</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Cliente</th>
              <th className="px-6 py-4 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-6 py-4 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-6 py-4 text-center font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="mt-3 text-sm">Cargando ventas...</p>
                  </div>
                </td>
              </tr>
            ) : filteredSales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">No hay ventas registradas</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSales.map((sale, i) => (
                <tr
                  key={sale.id}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-4 font-mono font-medium">#{sale.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(sale.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-muted-foreground">{sale.client?.name || 'Consumidor Final'}</td>
                  <td className="px-6 py-4">
                    {sale.status === 'PENDING_WEB' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                        🌐 Web Pendiente
                      </span>
                    ) : sale.status === 'CANCELLED' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                        ✕ Cancelado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                        ✓ Completado
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-primary">${Number(sale.total).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {sale.status === 'PENDING_WEB' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(sale.id, 'COMPLETED')}
                            className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-500 hover:bg-emerald-500/20"
                            title="Marcar como Completado"
                          >
                            ✓ Completar
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(sale.id, 'CANCELLED')}
                            className="inline-flex items-center rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20"
                            title="Cancelar Venta"
                          >
                            ✕ Cancelar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => generatePDF(sale)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                        title="Descargar Ticket PDF"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </div>
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
          <div className="relative w-full max-w-2xl animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registrar Nueva Venta</h2>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cliente (Opcional)</label>
                <select 
                  value={selectedClient} 
                  onChange={(e) => setSelectedClient(e.target.value)} 
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value="">Consumidor Final</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Agregar Producto</label>
                <select 
                  onChange={(e) => handleAddToCart(e.target.value)}
                  value=""
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Seleccione un producto para agregar...</option>
                  {products.filter(p => p.stock > 0).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (${p.price}) - Stock: {p.stock}</option>
                  ))}
                </select>
              </div>

              {/* Shopping Cart List */}
              <div className="rounded-lg border border-border/50 bg-background/50 p-4">
                <h3 className="mb-3 font-semibold text-sm">Productos en la Venta</h3>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay productos agregados.</p>
                ) : (
                  <ul className="space-y-2">
                    {cart.map(item => (
                      <li key={item.productId} className="flex items-center justify-between text-sm">
                        <span>{item.quantity}x {item.product?.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono">${(item.quantity * (item.product?.price || 0)).toFixed(2)}</span>
                          <button type="button" onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-300">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 border-t border-border pt-3 text-right font-bold text-lg text-primary">
                  Total: ${calculateTotal().toFixed(2)}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border hover:bg-accent">Cancelar</button>
                <button type="submit" disabled={saving || cart.length === 0} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg gradient-primary text-white hover:brightness-110 disabled:opacity-50">
                  {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Completar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
