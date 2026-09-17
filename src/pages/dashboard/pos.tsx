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
  Tag,
  AlertCircle,
  Gift,
  Scale,
  Printer,
} from 'lucide-react';
import { alertMessage } from '@/lib/alerts';
import { printTicket, TicketData } from '@/lib/printTicket';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  barcode: string | null;
  imageUrl: string | null;
  soldByWeight: boolean;
}

interface ComboItem {
  productId: string;
  quantity: number;
}

interface Combo {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  imageUrl: string | null;
  isActive: boolean;
  items: ComboItem[];
}

// Unified shape so products and combos can share the scan/search/cart flow.
interface Sellable {
  kind: 'product' | 'combo';
  id: string;
  name: string;
  description: string | null;
  price: number;
  barcode: string | null;
  stock: number;
  soldByWeight: boolean;
}

function comboAvailableStock(combo: Combo, products: Product[]): number {
  if (combo.items.length === 0) return 0;
  return Math.min(
    ...combo.items.map((ci) => {
      const product = products.find((p) => p.id === ci.productId);
      return product ? Math.floor(Number(product.stock) / ci.quantity) : 0;
    })
  );
}

interface CartItem extends Sellable {
  quantity: number;
}

interface Client {
  id: string;
  name: string;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
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

  // Price check (does not touch the cart)
  const [priceCheckOpen, setPriceCheckOpen] = useState(false);
  const [priceCheckQuery, setPriceCheckQuery] = useState('');
  const [priceCheckSelected, setPriceCheckSelected] = useState<Sellable | null>(null);
  const priceCheckRef = useRef<HTMLInputElement>(null);

  // Payment modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Success state
  const [lastSale, setLastSale] = useState<{ id: string; total: number; change: number } | null>(null);
  const [lastTicket, setLastTicket] = useState<TicketData | null>(null);

  // Receipt printing config
  const [businessName, setBusinessName] = useState('');
  const [ticketWidthMm, setTicketWidthMm] = useState(58);
  const [printTicketOnSale, setPrintTicketOnSale] = useState(true);
  const [printThisSale, setPrintThisSale] = useState(true);

  // Weight entry prompt (for products sold by weight)
  const [weightPromptFor, setWeightPromptFor] = useState<Sellable | null>(null);
  const [weightInput, setWeightInput] = useState('1');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const { business } = await meRes.json();
        setBusinessId(business.id);
        setBusinessName(business.name || '');

        const [prodRes, comboRes, cliRes, settingsRes] = await Promise.all([
          fetch('/api/products', { headers: { 'x-business-id': business.id } }),
          fetch('/api/combos', { headers: { 'x-business-id': business.id } }),
          fetch('/api/clients', { headers: { 'x-business-id': business.id } }),
          fetch('/api/business-settings', { headers: { 'x-business-id': business.id } }),
        ]);
        if (prodRes.ok) setProducts(await prodRes.json());
        if (comboRes.ok) setCombos(await comboRes.json());
        if (cliRes.ok) setClients(await cliRes.json());
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          setTicketWidthMm(settings.ticketWidthMm ?? 58);
          setPrintTicketOnSale(settings.printTicketOnSale ?? true);
          setPrintThisSale(settings.printTicketOnSale ?? true);
        }
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
    if (!payModalOpen && !searchOpen && !priceCheckOpen && !weightPromptFor && barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [payModalOpen, searchOpen, priceCheckOpen, weightPromptFor, cart]);

  // Focus the weight input as soon as the prompt opens
  useEffect(() => {
    if (weightPromptFor) {
      weightInputRef.current?.focus();
      weightInputRef.current?.select();
    }
  }, [weightPromptFor]);

  // Combined list of products + active combos, sharing the same searchable shape
  const sellables: Sellable[] = [
    ...products.map((p) => ({ kind: 'product' as const, id: p.id, name: p.name, description: p.description, price: Number(p.price), barcode: p.barcode, stock: Number(p.stock), soldByWeight: p.soldByWeight })),
    ...combos.filter((c) => c.isActive).map((c) => ({
      kind: 'combo' as const,
      id: c.id,
      name: c.name,
      description: null,
      price: Number(c.price),
      barcode: c.barcode,
      stock: comboAvailableStock(c, products),
      soldByWeight: false,
    })),
  ];

  // Add product/combo to cart
  const addToCart = useCallback((sellable: Sellable, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.kind === sellable.kind && i.id === sellable.id);
      if (existing) {
        const newQuantity = existing.quantity + quantity;
        if (newQuantity > sellable.stock) return prev; // can't exceed stock
        return prev.map(i =>
          i.kind === sellable.kind && i.id === sellable.id ? { ...i, quantity: newQuantity } : i
        );
      }
      if (quantity > sellable.stock) return prev;
      return [...prev, { ...sellable, quantity }];
    });
  }, []);

  // Weighable products ask for a weight (kg) before joining the cart
  const handleSelectSellable = (sellable: Sellable) => {
    if (sellable.soldByWeight) {
      setWeightPromptFor(sellable);
      setWeightInput('1');
      setWeightUnit('kg');
    } else {
      addToCart(sellable);
    }
  };

  // Weight is always tracked internally in kg (stock, cart quantity, price/kg) —
  // grams is just an alternate input unit that gets converted before use.
  const weightInKg = (() => {
    const n = parseFloat(weightInput);
    if (!n || n <= 0) return 0;
    return weightUnit === 'g' ? n / 1000 : n;
  })();

  const handleWeightUnitChange = (unit: 'kg' | 'g') => {
    if (unit === weightUnit) return;
    const current = parseFloat(weightInput);
    if (!isNaN(current) && current > 0) {
      const converted = unit === 'g' ? current * 1000 : current / 1000;
      setWeightInput(String(Number(converted.toFixed(3))));
    }
    setWeightUnit(unit);
  };

  const confirmWeightEntry = () => {
    if (!weightPromptFor) return;
    if (weightInKg <= 0) return;
    addToCart(weightPromptFor, weightInKg);
    setWeightPromptFor(null);
  };

  // Handle barcode scan (Enter key)
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const code = barcodeInput.trim();
      // Find by barcode first, then by name partial match
      const found = sellables.find(s =>
        s.barcode?.toLowerCase() === code.toLowerCase() ||
        s.name.toLowerCase() === code.toLowerCase()
      );
      if (found && found.stock > 0) {
        handleSelectSellable(found);
        setBarcodeInput('');
      } else {
        // Flash error (shake effect)
        barcodeRef.current?.classList.add('animate-shake');
        setTimeout(() => barcodeRef.current?.classList.remove('animate-shake'), 500);
      }
    }
  };

  // Handle price-check lookup (Enter key) — never touches the cart
  const handlePriceCheckScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !priceCheckQuery.trim()) return;
    const code = priceCheckQuery.trim().toLowerCase();
    const found = sellables.find(s =>
      s.barcode?.toLowerCase() === code ||
      s.name.toLowerCase() === code
    );
    if (found) {
      setPriceCheckSelected(found);
      setPriceCheckQuery('');
    }
  };

  const openPriceCheck = () => {
    setPriceCheckQuery('');
    setPriceCheckSelected(null);
    setPriceCheckOpen(true);
  };

  const closePriceCheck = () => {
    setPriceCheckOpen(false);
    setPriceCheckQuery('');
    setPriceCheckSelected(null);
  };

  // Change quantity
  const changeQty = (kind: 'product' | 'combo', id: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(i => {
          if (i.kind !== kind || i.id !== id) return i;
          const newQty = i.quantity + delta;
          if (newQty > i.stock) return i;
          return { ...i, quantity: newQty };
        })
        .filter(i => i.quantity > 0);
    });
  };

  const removeItem = (kind: 'product' | 'combo', id: string) => {
    setCart(prev => prev.filter(i => !(i.kind === kind && i.id === id)));
  };

  // Direct weight entry for weighable items (typed in kg, not stepped by 1)
  const setItemWeight = (kind: 'product' | 'combo', id: string, weight: number) => {
    setCart(prev =>
      prev
        .map(i => {
          if (i.kind !== kind || i.id !== id) return i;
          const clamped = Math.min(Math.max(weight, 0), i.stock);
          return { ...i, quantity: clamped };
        })
        .filter(i => i.quantity > 0)
    );
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

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
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
          items: cart.map(i => i.kind === 'combo'
            ? { comboId: i.id, quantity: i.quantity }
            : { productId: i.id, quantity: i.quantity }),
          status: 'COMPLETED',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alertMessage(data.error || 'Error al registrar la venta');
        return;
      }
      const sale = await res.json();
      setLastSale({ id: sale.id, total: cartTotal, change: Math.max(change, 0) });

      const ticket: TicketData = {
        businessName: businessName || 'Mi Negocio',
        widthMm: ticketWidthMm,
        saleId: sale.id,
        date: new Date(),
        items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, soldByWeight: i.soldByWeight })),
        total: cartTotal,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) || undefined : undefined,
        change: paymentMethod === 'cash' ? Math.max(change, 0) : undefined,
        clientName: clients.find(c => c.id === selectedClient)?.name,
      };
      setLastTicket(ticket);
      if (printThisSale) {
        printTicket(ticket);
      }

      setCart([]);
      setPayModalOpen(false);
      setCashReceived('');
      setSelectedClient('');

      // Reload products/combos to refresh stock
      const [prodRes, comboRes] = await Promise.all([
        fetch('/api/products', { headers: { 'x-business-id': businessId } }),
        fetch('/api/combos', { headers: { 'x-business-id': businessId } }),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (comboRes.ok) setCombos(await comboRes.json());
    } catch {
      alertMessage('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered sellables (products + combos) for manual search
  const filteredProducts = sellables.filter(s =>
    s.stock > 0 && (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.barcode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Filtered sellables for price check (out-of-stock items are still valid to look up)
  const priceCheckFiltered = priceCheckQuery.trim()
    ? sellables.filter(s =>
        s.name.toLowerCase().includes(priceCheckQuery.toLowerCase()) ||
        (s.barcode || '').toLowerCase().includes(priceCheckQuery.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(priceCheckQuery.toLowerCase())
      )
    : [];

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
            {lastTicket && (
              <button
                onClick={() => printTicket(lastTicket)}
                title="Reimprimir ticket"
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setLastSale(null)} className="ml-1 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 md:h-[calc(100vh-4rem)] md:flex-row">
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
            <div className="flex-1 overflow-auto">
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
                      <tr key={`${item.kind}-${item.id}`} className="border-b border-border/20 hover:bg-muted/10 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="px-5 py-3">
                          <p className="font-semibold flex items-center gap-1.5">
                            {item.kind === 'combo' && <Gift className="h-3.5 w-3.5 shrink-0 text-primary" />}
                            {item.name}
                          </p>
                          {item.barcode && (
                            <p className="text-xs text-muted-foreground font-mono">{item.barcode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.soldByWeight ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                max={item.stock}
                                value={item.quantity}
                                onChange={(e) => setItemWeight(item.kind, item.id, parseFloat(e.target.value) || 0)}
                                className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-center font-bold tabular-nums"
                              />
                              <span className="text-xs text-muted-foreground">kg</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => changeQty(item.kind, item.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors">
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-12 text-center font-bold text-lg tabular-nums">{item.quantity}</span>
                              <button onClick={() => changeQty(item.kind, item.id, 1)} disabled={item.quantity >= item.stock} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-30">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">${item.price.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right font-bold text-primary font-mono">${(item.price * item.quantity).toFixed(2)}</td>
                        <td className="px-3 py-3">
                          <button onClick={() => removeItem(item.kind, item.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
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
        <div className="flex w-full shrink-0 flex-col gap-4 md:w-80">
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
            onClick={() => { setPayModalOpen(true); setCashReceived(''); setPrintThisSale(printTicketOnSale); }}
            disabled={cart.length === 0}
            className="h-16 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-xl font-black text-white shadow-xl shadow-emerald-500/25 transition-all duration-200 hover:shadow-2xl hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-3"
          >
            <Banknote className="h-7 w-7" />
            COBRAR
          </button>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3">
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
            <button
              onClick={openPriceCheck}
              title="Consultar precio sin agregar a la venta"
              className="rounded-xl border border-border py-3 text-sm font-medium hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
            >
              <Tag className="h-4 w-4" />
              Precio
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
                placeholder="Buscar producto u oferta por nombre o código..."
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
                    key={`${p.kind}-${p.id}`}
                    onClick={() => { handleSelectSellable(p); setSearchOpen(false); }}
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border/20"
                  >
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">
                        {p.kind === 'combo' && <Gift className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.barcode && <span className="font-mono mr-2">{p.barcode}</span>}
                        Stock: {p.stock}
                      </p>
                    </div>
                    <span className="font-bold text-primary">${p.price.toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Price Check Modal — read-only, never adds to the cart */}
      {priceCheckOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePriceCheck} />
          <div className="relative w-full max-w-lg animate-slide-up rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border/50 px-4">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <input
                ref={priceCheckRef}
                autoFocus
                type="text"
                value={priceCheckQuery}
                onChange={e => setPriceCheckQuery(e.target.value)}
                onKeyDown={handlePriceCheckScan}
                placeholder="Escanear código o escribir nombre para ver el precio..."
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={closePriceCheck} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            {priceCheckSelected && (
              <div className="border-b border-border/50 bg-muted/20 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold flex items-center gap-1.5">
                      {priceCheckSelected.kind === 'combo' && <Gift className="h-4 w-4 shrink-0 text-primary" />}
                      {priceCheckSelected.name}
                    </p>
                    {priceCheckSelected.barcode && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{priceCheckSelected.barcode}</p>
                    )}
                    <span
                      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        priceCheckSelected.stock <= 5
                          ? 'bg-red-500/15 text-red-400'
                          : priceCheckSelected.stock <= 20
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {priceCheckSelected.stock <= 5 && <AlertCircle className="h-3 w-3" />}
                      Stock: {priceCheckSelected.stock}
                    </span>
                  </div>
                  <p className="text-3xl font-black text-primary tabular-nums shrink-0">
                    ${priceCheckSelected.price.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto">
              {!priceCheckQuery.trim() ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Tag className="mx-auto mb-3 h-10 w-10 opacity-20" />
                  Escribí un nombre o escaneá un código de barra
                </div>
              ) : priceCheckFiltered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-3 h-10 w-10 opacity-20" />
                  No se encontraron productos
                </div>
              ) : (
                priceCheckFiltered.slice(0, 20).map(p => (
                  <button
                    key={`${p.kind}-${p.id}`}
                    onClick={() => setPriceCheckSelected(p)}
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border/20"
                  >
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">
                        {p.kind === 'combo' && <Gift className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.barcode && <span className="font-mono mr-2">{p.barcode}</span>}
                        Stock: {p.stock}
                      </p>
                    </div>
                    <span className="font-bold text-primary">${p.price.toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weight entry prompt — for products sold by weight (kg) */}
      {weightPromptFor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setWeightPromptFor(null)} />
          <div className="relative w-full max-w-sm animate-slide-up rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Scale className="h-5 w-5 text-primary" />
                Ingresar Peso
              </h2>
              <button onClick={() => setWeightPromptFor(null)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-1 font-semibold">{weightPromptFor.name}</p>
            <p className="mb-4 text-sm text-muted-foreground">${weightPromptFor.price.toFixed(2)} / kg</p>
            <div className="mb-4 flex gap-2">
              <input
                ref={weightInputRef}
                type="number"
                step={weightUnit === 'g' ? '1' : '0.001'}
                min="0"
                max={weightUnit === 'g' ? weightPromptFor.stock * 1000 : weightPromptFor.stock}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmWeightEntry()}
                className="h-14 flex-1 rounded-xl border-2 border-input bg-background/50 px-4 text-center text-2xl font-bold tabular-nums focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              <div className="flex h-14 w-16 shrink-0 flex-col overflow-hidden rounded-xl border-2 border-input">
                <button
                  type="button"
                  onClick={() => handleWeightUnitChange('kg')}
                  className={`flex-1 text-xs font-bold transition-colors ${weightUnit === 'kg' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  KG
                </button>
                <button
                  type="button"
                  onClick={() => handleWeightUnitChange('g')}
                  className={`flex-1 border-t border-input text-xs font-bold transition-colors ${weightUnit === 'g' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  G
                </button>
              </div>
            </div>
            {weightInKg > 0 && (
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Subtotal: <span className="font-bold text-primary">${(weightPromptFor.price * weightInKg).toFixed(2)}</span>
              </p>
            )}
            <button
              onClick={confirmWeightEntry}
              disabled={weightInKg <= 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
              Agregar a la venta
            </button>
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

            {/* Print ticket toggle */}
            <label className="mb-6 flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={printThisSale}
                onChange={e => setPrintThisSale(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <Printer className="h-4 w-4 text-muted-foreground" />
              <span>Imprimir ticket de esta venta</span>
            </label>

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
