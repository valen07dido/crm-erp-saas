import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ScanBarcode,
  Package,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Search,
  Maximize,
  Minimize,
  ArrowLeft,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  imageUrl: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Client {
  id: string;
  name: string;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Barcode / search input
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Manual search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Payment modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Success state
  const [lastSale, setLastSale] = useState<{ id: string; total: number; change: number } | null>(null);

  // Load data
  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const { business } = await meRes.json();
        setBusinessId(business.id);

        const [prodRes, cliRes] = await Promise.all([
          fetch('/api/products', { headers: { 'x-business-id': business.id } }),
          fetch('/api/clients', { headers: { 'x-business-id': business.id } }),
        ]);
        if (prodRes.ok) setProducts(await prodRes.json());
        if (cliRes.ok) setClients(await cliRes.json());
      } catch (e) {
        console.error('POS init error', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Keep barcode input focused
  useEffect(() => {
    if (!payModalOpen && !searchOpen && barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [payModalOpen, searchOpen, cart]);

  // Add product to cart
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev; // can't exceed stock
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  // Handle barcode scan (Enter key)
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const code = barcodeInput.trim();
      // Find by barcode first, then by name partial match
      const found = products.find(p =>
        p.barcode?.toLowerCase() === code.toLowerCase() ||
        p.name.toLowerCase() === code.toLowerCase()
      );
      if (found && found.stock > 0) {
        addToCart(found);
        setBarcodeInput('');
      } else {
        // Flash error (shake effect)
        barcodeRef.current?.classList.add('animate-shake');
        setTimeout(() => barcodeRef.current?.classList.remove('animate-shake'), 500);
      }
    }
  };

  // Change quantity
  const changeQty = (productId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(i => {
          if (i.product.id !== productId) return i;
          const newQty = i.quantity + delta;
          if (newQty > i.product.stock) return i;
          return { ...i, quantity: newQty };
        })
        .filter(i => i.quantity > 0);
    });
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(err => console.error(err));
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const change = paymentMethod === 'cash' && cashReceived
    ? parseFloat(cashReceived) - cartTotal
    : 0;

  // Submit sale
  const handleCompleteSale = async () => {
    if (!businessId || cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-business-id': businessId,
        },
        body: JSON.stringify({
          clientId: selectedClient || null,
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
          status: 'COMPLETED',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al registrar la venta');
        return;
      }
      const sale = await res.json();
      setLastSale({ id: sale.id, total: cartTotal, change: Math.max(change, 0) });
      setCart([]);
      setPayModalOpen(false);
      setCashReceived('');
      setSelectedClient('');

      // Reload products to refresh stock
      const prodRes = await fetch('/api/products', { headers: { 'x-business-id': businessId } });
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch {
      alert('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered products for manual search
  const filteredProducts = products.filter(p =>
    p.stock > 0 && (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 flex flex-col">
      {/* Success toast */}
      {lastSale && (
        <div className="fixed top-6 right-6 z-[200] animate-slide-up">
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-card p-5 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-emerald-400">¡Venta registrada!</p>
              <p className="text-sm text-muted-foreground">Total: ${lastSale.total.toFixed(2)}</p>
              {lastSale.change > 0 && (
                <p className="text-sm font-bold text-amber-400">Vuelto: ${lastSale.change.toFixed(2)}</p>
              )}
            </div>
            <button onClick={() => setLastSale(null)} className="ml-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-4rem)] gap-6">
        {/* Left: Scanner + Product list */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <ScanBarcode className="h-7 w-7 text-emerald-400" />
                  Punto de Venta
                </h1>
              </div>
              <p className="text-sm text-muted-foreground ml-11">Escanea o busca productos para agregar a la venta</p>
            </div>
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              {isFullscreen ? (
                <><Minimize className="h-4 w-4" /> Salir de Modo Cajero</>
              ) : (
                <><Maximize className="h-4 w-4" /> Modo Cajero</>
              )}
            </button>
          </div>

          {/* Barcode Scanner Input */}
          <div className="relative mb-4">
            <ScanBarcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-emerald-400" />
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeScan}
              placeholder="Escanear código de barras o escribir nombre del producto..."
              className="h-14 w-full rounded-2xl border-2 border-emerald-500/30 bg-card pl-14 pr-14 text-lg font-medium transition-all duration-200 placeholder:text-muted-foreground focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
              autoFocus
            />
            <button
              onClick={() => { setSearchOpen(true); setSearchQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-accent"
              title="Buscar manualmente"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg flex flex-col">
            <div className="border-b border-border/50 bg-muted/20 px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Productos en la venta ({cartCount})</span>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300 font-medium">
                  Limpiar todo
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                  <ScanBarcode className="mb-4 h-16 w-16 opacity-15" />
                  <p className="font-medium">Escanea un producto para comenzar</p>
                  <p className="text-xs mt-1">Los productos aparecerán aquí automáticamente</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10 sticky top-0">
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground">Producto</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground w-36">Cantidad</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">P. Unit.</th>
                      <th className="px-5 py-3 text-right font-medium text-muted-foreground">Subtotal</th>
                      <th className="px-3 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, i) => (
                      <tr key={item.product.id} className="border-b border-border/20 hover:bg-muted/10 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="px-5 py-3">
                          <p className="font-semibold">{item.product.name}</p>
                          {item.product.barcode && (
                            <p className="text-xs text-muted-foreground font-mono">{item.product.barcode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => changeQty(item.product.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-12 text-center font-bold text-lg tabular-nums">{item.quantity}</span>
                            <button onClick={() => changeQty(item.product.id, 1)} disabled={item.quantity >= item.product.stock} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-30">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">${Number(item.product.price).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right font-bold text-primary font-mono">${(Number(item.product.price) * item.quantity).toFixed(2)}</td>
                        <td className="px-3 py-3">
                          <button onClick={() => removeItem(item.product.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right: Totals Panel */}
        <div className="w-80 flex flex-col gap-4 shrink-0">
          {/* Total Card */}
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-lg">
            <p className="text-sm font-medium text-muted-foreground mb-2">Total a cobrar</p>
            <p className="text-5xl font-black tabular-nums text-primary">${cartTotal.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-2">{cartCount} producto{cartCount !== 1 ? 's' : ''} en la venta</p>
          </div>

          {/* Client selector */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-lg">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Cliente</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full rounded-xl border border-input bg-background/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Consumidor Final</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Cobrar Button */}
          <button
            onClick={() => { setPayModalOpen(true); setCashReceived(''); }}
            disabled={cart.length === 0}
            className="h-16 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-xl font-black text-white shadow-xl shadow-emerald-500/25 transition-all duration-200 hover:shadow-2xl hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-3"
          >
            <Banknote className="h-7 w-7" />
            COBRAR
          </button>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="rounded-xl border border-border py-3 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-30"
            >
              Cancelar
            </button>
            <button
              onClick={() => { setSearchOpen(true); setSearchQuery(''); }}
              className="rounded-xl border border-border py-3 text-sm font-medium hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Manual Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-lg animate-slide-up rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border/50 px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar producto por nombre o código..."
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => setSearchOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-3 h-10 w-10 opacity-20" />
                  No se encontraron productos
                </div>
              ) : (
                filteredProducts.slice(0, 20).map(p => (
                  <button
                    key={p.id}
                    onClick={() => { addToCart(p); setSearchOpen(false); }}
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border/20"
                  >
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.barcode && <span className="font-mono mr-2">{p.barcode}</span>}
                        Stock: {p.stock}
                      </p>
                    </div>
                    <span className="font-bold text-primary">${Number(p.price).toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPayModalOpen(false)} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Cobrar Venta</h2>
              <button onClick={() => setPayModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Total */}
            <div className="rounded-xl bg-primary/10 p-5 text-center mb-6">
              <p className="text-sm text-muted-foreground mb-1">Total</p>
              <p className="text-4xl font-black text-primary tabular-nums">${cartTotal.toFixed(2)}</p>
            </div>

            {/* Payment Method */}
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">Método de pago</label>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { key: 'cash' as const, label: 'Efectivo', icon: Banknote },
                { key: 'card' as const, label: 'Tarjeta', icon: CreditCard },
                { key: 'transfer' as const, label: 'Transferencia', icon: ArrowRightLeft },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                    paymentMethod === m.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <m.icon className="h-6 w-6" />
                  {m.label}
                </button>
              ))}
            </div>

            {/* Cash received (only for cash) */}
            {paymentMethod === 'cash' && (
              <div className="mb-6">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Monto recibido</label>
                <input
                  type="number"
                  step="0.01"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  className="h-14 w-full rounded-xl border-2 border-input bg-background/50 px-4 text-2xl font-bold tabular-nums text-center focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoFocus
                />
                {cashReceived && parseFloat(cashReceived) >= cartTotal && (
                  <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Vuelto</p>
                    <p className="text-3xl font-black text-emerald-400 tabular-nums">
                      ${(parseFloat(cashReceived) - cartTotal).toFixed(2)}
                    </p>
                  </div>
                )}
                {cashReceived && parseFloat(cashReceived) < cartTotal && (
                  <p className="mt-2 text-center text-sm text-red-400">Monto insuficiente</p>
                )}
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={handleCompleteSale}
              disabled={
                submitting ||
                cart.length === 0 ||
                (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < cartTotal))
              }
              className="h-14 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-lg font-black text-white shadow-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Confirmar Venta
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-4px); }
        }
        :global(.animate-shake) {
          animation: shake 0.4s ease-in-out;
          border-color: #ef4444 !important;
        }
      `}</style>
    </div>
  );
}
