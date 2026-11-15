import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Store, ShoppingBag, Package, ChevronRight, ChevronLeft, X, Plus, Minus, Trash2,
  CheckCircle, Loader, Gift, Search, Phone, Mail, MapPin, MessageCircle,
} from 'lucide-react';
import { getFontPairing, STOREFRONT_FONT_CLASSNAME } from '@/lib/storefront-fonts';

export interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  stock: number;
  category: string | null;
}

export interface StorefrontOffer {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  stock: number;
}

export interface StorefrontConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string | null;
  themeMode: string;
  fontPairing: string;
  buttonStyle: string;
  faviconUrl: string | null;
  logoUrl: string | null;
  aboutText: string | null;
  aboutImageUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  whatsappNumber: string | null;
}

interface CartItem {
  kind: 'product' | 'combo';
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  stock: number;
  quantity: number;
}

function radiusClass(style: string) {
  if (style === 'square') return 'rounded-md';
  if (style === 'pill') return 'rounded-full';
  return 'rounded-xl'; // 'rounded' (default)
}

interface StorefrontViewProps {
  businessName: string;
  businessSlug: string;
  config: StorefrontConfig;
  products: StorefrontProduct[];
  offers: StorefrontOffer[];
  /** false disables add-to-cart/checkout — used by the Studio live preview,
   * where the point is to check the LOOK, not to actually place test orders. */
  interactive?: boolean;
}

export function StorefrontView({
  businessName,
  businessSlug,
  config,
  products,
  offers,
  interactive = true,
}: StorefrontViewProps) {
  const {
    heroTitle, heroSubtitle, heroImageUrl, primaryColor, secondaryColor,
    backgroundColor, themeMode, fontPairing, buttonStyle,
    logoUrl, aboutText, aboutImageUrl, contactPhone, contactEmail, contactAddress, whatsappNumber,
  } = config;

  const isDark = themeMode === 'dark';
  const bgColor = backgroundColor || (isDark ? '#09090b' : '#f8fafc');
  const textColor = isDark ? '#fafafa' : '#0f172a';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const mutedText = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const pairing = getFontPairing(fontPairing);
  const radius = radiusClass(buttonStyle);

  // Cart state — scoped to this component instance. In preview mode this is
  // just local UI state (nothing is persisted or submitted); on the real
  // public page it's the customer's actual cart.
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const CART_KEY = `cart_${businessSlug}`;
  useEffect(() => {
    if (!interactive) return;
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((i) => i && i.kind && i.id)) setCart(parsed);
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CART_KEY]);
  useEffect(() => {
    if (!interactive) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, CART_KEY]);

  const addToCart = useCallback((kind: 'product' | 'combo', entry: StorefrontProduct | StorefrontOffer) => {
    if (!interactive) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.kind === kind && i.id === entry.id);
      if (existing) {
        if (existing.quantity >= entry.stock) return prev;
        return prev.map((i) => (i.kind === kind && i.id === entry.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { kind, id: entry.id, name: entry.name, price: entry.price, imageUrl: entry.imageUrl, stock: entry.stock, quantity: 1 }];
    });
    setCartOpen(true);
  }, [interactive]);

  const changeQty = (kind: 'product' | 'combo', id: string, delta: number) => {
    setCart((prev) => prev
      .map((i) => (i.kind === kind && i.id === id ? { ...i, quantity: i.quantity + delta } : i))
      .filter((i) => i.quantity > 0));
  };

  const removeItem = (kind: 'product' | 'combo', id: string) =>
    setCart((prev) => prev.filter((i) => !(i.kind === kind && i.id === id)));

  const cartTotal = cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const offersScrollRef = useRef<HTMLDivElement>(null);
  const scrollOffers = (dir: 'left' | 'right') => {
    offersScrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter((c): c is string => !!c))).sort(),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, activeCategory]);

  const hasContact = !!(contactPhone || contactEmail || contactAddress || whatsappNumber);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactive) return;
    if (!checkoutForm.name.trim()) { setCheckoutError('El nombre es requerido.'); return; }
    setSubmitting(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/public/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug,
          customerName: checkoutForm.name,
          customerEmail: checkoutForm.email || undefined,
          customerPhone: checkoutForm.phone || undefined,
          items: cart.map((i) => (i.kind === 'combo' ? { comboId: i.id, quantity: i.quantity } : { productId: i.id, quantity: i.quantity })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCheckoutError(data.error || 'Error procesando el pedido');
        return;
      }
      setCart([]);
      setStep('success');
    } catch {
      setCheckoutError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeCart = () => {
    setCartOpen(false);
    setTimeout(() => setStep('cart'), 300);
  };

  return (
    <div
      className={`sf-root ${STOREFRONT_FONT_CLASSNAME}`}
      style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh', fontFamily: pairing.bodyVar }}
    >
      {/* Cart Sidebar Overlay */}
      {cartOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeCart} />
          <div
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col shadow-2xl"
            style={{ backgroundColor: isDark ? '#0f0f12' : '#ffffff', borderLeft: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor }}>
              <h2 className="flex items-center gap-2 text-xl font-bold" style={{ fontFamily: pairing.headingVar }}>
                <ShoppingBag className="h-5 w-5" style={{ color: primaryColor }} />
                {step === 'success' ? '¡Pedido Enviado!' : step === 'checkout' ? 'Datos de Contacto' : `Mi Carrito (${cartCount})`}
              </h2>
              <button onClick={closeCart} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {step === 'success' && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: `${primaryColor}20` }}>
                    <CheckCircle className="h-10 w-10" style={{ color: primaryColor }} />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold" style={{ fontFamily: pairing.headingVar }}>¡Pedido Confirmado!</h3>
                  <p style={{ color: mutedText }} className="text-sm leading-relaxed">
                    Tu pedido fue enviado al local. Te contactarán pronto para coordinar la entrega o retiro.
                  </p>
                  <button
                    onClick={closeCart}
                    className={`mt-8 px-8 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 ${radius}`}
                    style={{ backgroundColor: primaryColor }}
                  >
                    Continuar comprando
                  </button>
                </div>
              )}

              {step === 'cart' && (
                cart.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center" style={{ color: mutedText }}>
                    <ShoppingBag className="mb-4 h-16 w-16 opacity-20" />
                    <p className="font-medium">Tu carrito está vacío</p>
                    <p className="mt-1 text-sm">Agrega productos para continuar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={`${item.kind}-${item.id}`} className="flex gap-4 rounded-xl p-3" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              {item.kind === 'combo' ? <Gift className="h-8 w-8 opacity-20" /> : <Package className="h-8 w-8 opacity-20" />}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                            {item.kind === 'combo' && <Gift className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />}
                            {item.name}
                          </p>
                          <p className="mt-1 font-bold" style={{ color: primaryColor }}>${Number(item.price).toFixed(2)}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 rounded-lg border" style={{ borderColor }}>
                              <button onClick={() => changeQty(item.kind, item.id, -1)} className="flex h-7 w-7 items-center justify-center hover:opacity-70">
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                              <button onClick={() => changeQty(item.kind, item.id, 1)} disabled={item.quantity >= item.stock} className="flex h-7 w-7 items-center justify-center hover:opacity-70 disabled:opacity-30">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <button onClick={() => removeItem(item.kind, item.id)} className="text-red-400 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {step === 'checkout' && (
                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4">
                  <p style={{ color: mutedText }} className="mb-2 text-sm">Completa tus datos para enviar el pedido al local.</p>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Nombre completo *</label>
                    <input
                      required
                      value={checkoutForm.name}
                      onChange={(e) => setCheckoutForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Juan García"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all focus:ring-2"
                      style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: textColor }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Email (opcional)</label>
                    <input
                      type="email"
                      value={checkoutForm.email}
                      onChange={(e) => setCheckoutForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="juan@ejemplo.com"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all focus:ring-2"
                      style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: textColor }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Teléfono (opcional)</label>
                    <input
                      type="tel"
                      value={checkoutForm.phone}
                      onChange={(e) => setCheckoutForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+54 11 1234-5678"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all focus:ring-2"
                      style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: textColor }}
                    />
                  </div>
                  {checkoutError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{checkoutError}</p>}
                  <div className="mt-4 space-y-2 rounded-xl p-4" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                    <p className="mb-2 text-sm font-semibold">Resumen del pedido</p>
                    {cart.map((i) => (
                      <div key={`${i.kind}-${i.id}`} className="flex justify-between text-sm" style={{ color: mutedText }}>
                        <span>{i.name} x{i.quantity}</span>
                        <span>${(Number(i.price) * i.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-2 font-bold" style={{ borderColor }}>
                      <span>Total</span>
                      <span style={{ color: primaryColor }}>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {step !== 'success' && (
              <div className="space-y-3 border-t px-6 py-5" style={{ borderColor }}>
                {step === 'cart' && (
                  <>
                    <div className="flex items-center justify-between text-sm" style={{ color: mutedText }}>
                      <span>Subtotal ({cartCount} items)</span>
                      <span className="text-lg font-black" style={{ color: textColor }}>${cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => setStep('checkout')}
                      disabled={cart.length === 0}
                      className={`flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-30 ${radius}`}
                      style={{ backgroundColor: primaryColor }}
                    >
                      Proceder al checkout
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                {step === 'checkout' && (
                  <div className="flex gap-3">
                    <button onClick={() => setStep('cart')} className={`flex flex-1 items-center justify-center border py-3 text-sm font-medium transition-all hover:opacity-70 ${radius}`} style={{ borderColor }}>
                      Volver
                    </button>
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={submitting}
                      className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50 ${radius}`}
                      style={{ backgroundColor: primaryColor }}
                    >
                      {submitting ? <Loader className="h-4 w-4 animate-spin" /> : 'Confirmar pedido'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b backdrop-blur-xl" style={{ borderColor, backgroundColor: isDark ? 'rgba(9,9,11,0.8)' : 'rgba(255,255,255,0.85)' }}>
        <div className="container mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3 text-2xl font-black tracking-tight" style={{ color: primaryColor, fontFamily: pairing.headingVar }}>
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${primaryColor}20` }}>
                <Store className="h-6 w-6" />
              </div>
            )}
            <span className="truncate">{businessName}</span>
          </div>
          <div className="sf-nav-links items-center gap-6 text-sm font-medium" style={{ color: mutedText }}>
            <a href="#catalogo" className="transition-colors hover:opacity-80">Productos</a>
            {aboutText && <a href="#sobre-nosotros" className="transition-colors hover:opacity-80">Nosotros</a>}
            {hasContact && <a href="#contacto" className="transition-colors hover:opacity-80">Contacto</a>}
          </div>
          <button
            onClick={() => interactive && setCartOpen(true)}
            className={`relative flex shrink-0 items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 ${radius}`}
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black" style={{ color: primaryColor }}>
                {cartCount}
              </span>
            )}
            <span className="sf-cart-label">Mi Carrito</span>
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden pb-20 pt-28 sm:pb-28 sm:pt-36">
        {heroImageUrl && (
          <div className="absolute inset-0 z-0">
            <img src={heroImageUrl} alt={businessName} className="h-full w-full scale-105 object-cover opacity-20 blur-xl" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bgColor}, transparent)` }} />
          </div>
        )}
        <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center">
          <h1 className="sf-hero-title mb-8 font-black tracking-tighter" style={{ fontFamily: pairing.headingVar }}>{heroTitle}</h1>
          <p className="mx-auto mb-12 max-w-2xl text-xl leading-relaxed sm:text-2xl" style={{ color: mutedText }}>{heroSubtitle}</p>
          <a
            href="#catalogo"
            className={`inline-flex items-center gap-2 px-8 py-4 text-lg font-bold text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${radius}`}
            style={{ backgroundColor: primaryColor }}
          >
            Explorar Productos
            <ChevronRight className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* Offers Slider */}
      {offers.length > 0 && (
        <section className="border-b py-16" style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}>
          <div className="container mx-auto max-w-7xl px-6">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${secondaryColor}20` }}>
                  <Gift className="h-6 w-6" style={{ color: secondaryColor }} />
                </div>
                <div>
                  <h2 className="flex flex-wrap items-center gap-2 text-3xl font-black tracking-tight" style={{ fontFamily: pairing.headingVar }}>
                    Ofertas
                    <span className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: secondaryColor }}>
                      Precio especial
                    </span>
                  </h2>
                  <p className="text-sm" style={{ color: mutedText }}>Combos armados a un precio más conveniente</p>
                </div>
              </div>
              <div className="hidden shrink-0 gap-2 sm:flex">
                <button onClick={() => scrollOffers('left')} className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:opacity-70" style={{ borderColor }} aria-label="Ver ofertas anteriores">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => scrollOffers('right')} className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:opacity-70" style={{ borderColor }} aria-label="Ver más ofertas">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div ref={offersScrollRef} className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4">
              {offers.map((offer) => {
                const inCart = cart.find((i) => i.kind === 'combo' && i.id === offer.id);
                return (
                  <div key={offer.id} className="group relative flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-3xl border-2 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl" style={{ borderColor: secondaryColor, backgroundColor: cardBg }}>
                    <span className="absolute left-4 top-4 z-10 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-lg" style={{ backgroundColor: secondaryColor }}>
                      Oferta
                    </span>
                    <div className="aspect-square overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                      {offer.imageUrl ? (
                        <img src={offer.imageUrl} alt={offer.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Gift className="h-20 w-20 opacity-10" /></div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: pairing.headingVar }}>{offer.name}</h3>
                      <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed" style={{ color: mutedText }}>{offer.description || 'Combo especial'}</p>
                      <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor }}>
                        <span className="text-xl font-black" style={{ color: secondaryColor }}>${Number(offer.price).toFixed(2)}</span>
                        {inCart ? (
                          <div className="flex items-center gap-2 rounded-xl border px-2.5 py-1" style={{ borderColor }}>
                            <button onClick={() => changeQty('combo', offer.id, -1)} className="hover:opacity-70"><Minus className="h-3.5 w-3.5" /></button>
                            <span className="w-5 text-center text-sm font-bold tabular-nums">{inCart.quantity}</span>
                            <button onClick={() => changeQty('combo', offer.id, 1)} disabled={inCart.quantity >= offer.stock} className="hover:opacity-70 disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart('combo', offer)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-110 ${radius}`} style={{ backgroundColor: secondaryColor }}>
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      {aboutText && (
        <section id="sobre-nosotros" className="container mx-auto max-w-7xl border-b px-6 py-20" style={{ borderColor }}>
          <div className="sf-about-grid">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold tracking-tight" style={{ fontFamily: pairing.headingVar }}>Sobre Nosotros</h2>
              <p className="whitespace-pre-line text-lg leading-relaxed" style={{ color: mutedText }}>{aboutText}</p>
            </div>
            {aboutImageUrl && (
              <div className="relative aspect-video overflow-hidden rounded-3xl shadow-2xl md:aspect-square">
                <img src={aboutImageUrl} alt="Sobre Nosotros" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Catalog */}
      <main id="catalogo" className="container mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-4xl font-bold tracking-tight" style={{ fontFamily: pairing.headingVar }}>Productos</h2>
          {products.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: mutedText }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:ring-2"
                style={{ borderColor, backgroundColor: cardBg, color: textColor }}
              />
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={activeCategory === null ? { backgroundColor: primaryColor, color: '#fff' } : { backgroundColor: cardBg, color: mutedText, border: `1px solid ${borderColor}` }}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                style={activeCategory === cat ? { backgroundColor: primaryColor, color: '#fff' } : { backgroundColor: cardBg, color: mutedText, border: `1px solid ${borderColor}` }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border py-32" style={{ borderColor, backgroundColor: cardBg }}>
            <Package className="mb-6 h-20 w-20 opacity-20" />
            <p className="text-2xl font-medium" style={{ color: mutedText }}>
              {products.length === 0 ? 'Aún no hay productos disponibles' : 'No encontramos productos con ese criterio'}
            </p>
          </div>
        ) : (
          <div className="sf-product-grid">
            {filteredProducts.map((product) => {
              const inCart = cart.find((i) => i.kind === 'product' && i.id === product.id);
              return (
                <div key={product.id} className="group relative flex flex-col overflow-hidden rounded-3xl border shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl" style={{ borderColor, backgroundColor: cardBg }}>
                  <div className="aspect-square overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><Package className="h-24 w-24 opacity-10" /></div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    {product.category && (
                      <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: secondaryColor }}>{product.category}</span>
                    )}
                    <h3 className="text-xl font-bold tracking-tight" style={{ fontFamily: pairing.headingVar }}>{product.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed line-clamp-2" style={{ color: mutedText }}>{product.description || 'Sin descripción'}</p>
                    <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor }}>
                      <span className="text-2xl font-black" style={{ color: primaryColor }}>${Number(product.price).toFixed(2)}</span>
                      {inCart ? (
                        <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5" style={{ borderColor }}>
                          <button onClick={() => changeQty('product', product.id, -1)} className="hover:opacity-70"><Minus className="h-4 w-4" /></button>
                          <span className="w-5 text-center text-sm font-bold tabular-nums">{inCart.quantity}</span>
                          <button onClick={() => changeQty('product', product.id, 1)} disabled={inCart.quantity >= product.stock} className="hover:opacity-70 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart('product', product)} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 ${radius}`} style={{ backgroundColor: primaryColor }}>
                          <ShoppingBag className="h-4 w-4" />
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer id="contacto" className="border-t py-12 text-sm" style={{ borderColor, color: mutedText }}>
        <div className="container mx-auto max-w-7xl px-6">
          {hasContact && (
            <div className="mb-8 flex flex-wrap justify-center gap-x-8 gap-y-3 border-b pb-8 text-center" style={{ borderColor }}>
              {contactPhone && (
                <span className="flex items-center gap-2"><Phone className="h-4 w-4" style={{ color: primaryColor }} /> {contactPhone}</span>
              )}
              {contactEmail && (
                <span className="flex items-center gap-2"><Mail className="h-4 w-4" style={{ color: primaryColor }} /> {contactEmail}</span>
              )}
              {contactAddress && (
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4" style={{ color: primaryColor }} /> {contactAddress}</span>
              )}
              {whatsappNumber && (
                <a
                  href={interactive ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 font-medium transition-opacity hover:opacity-80"
                  style={{ color: primaryColor }}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>
          )}
          <p className="text-center font-medium">© {new Date().getFullYear()} {businessName}. Impulsado por Walti.</p>
        </div>
      </footer>
    </div>
  );
}
