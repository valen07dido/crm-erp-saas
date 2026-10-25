import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState, useEffect, useCallback, useRef } from 'react';
import prisma from '@/lib/prisma';
import { Store, ShoppingBag, Package, ChevronRight, ChevronLeft, X, Plus, Minus, Trash2, CheckCircle, Loader, Gift } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  stock: number;
}

interface ComboOffer {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  stock: number;
}

interface StorefrontProps {
  businessName: string;
  businessSlug: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string | null;
  primaryColor: string;
  backgroundColor: string | null;
  themeMode: string;
  logoUrl: string | null;
  aboutText: string | null;
  aboutImageUrl: string | null;
  products: Product[];
  offers: ComboOffer[];
}

// Products and combo offers are sold the same way on the storefront, so the
// cart tracks them in one unified shape (kind+id disambiguates the two).
interface CartItem {
  kind: 'product' | 'combo';
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  stock: number;
  quantity: number;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { businessSlug } = context.params as { businessSlug: string };

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    include: {
      storefront: true,
      products: true,
      combos: {
        where: { isActive: true },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!business) return { notFound: true };

  const sf = business.storefront;

  // A combo's available stock is capped by its scarcest component — e.g. a
  // combo needing 2x of a product that only has 3 left can sell at most 1.
  const comboAvailableStock = (items: { productId: string; quantity: unknown }[]) => {
    if (items.length === 0) return 0;
    return Math.min(
      ...items.map((ci) => {
        const product = business.products.find((p) => p.id === ci.productId);
        return product ? Math.floor(Number(product.stock) / Number(ci.quantity)) : 0;
      })
    );
  };

  return {
    props: {
      businessName: business.name,
      businessSlug: business.slug,
      heroTitle: sf?.heroTitle || `Bienvenido a ${business.name}`,
      heroSubtitle: sf?.heroSubtitle || 'Los mejores productos al mejor precio',
      heroImageUrl: sf?.heroImageUrl || null,
      primaryColor: sf?.primaryColor || '#3b82f6',
      backgroundColor: sf?.backgroundColor || null,
      themeMode: sf?.themeMode || 'dark',
      logoUrl: sf?.logoUrl || null,
      aboutText: sf?.aboutText || null,
      aboutImageUrl: sf?.aboutImageUrl || null,
      products: business.products
        .filter(p => Number(p.stock) > 0)
        .map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price.toString(),
          imageUrl: p.imageUrl || null,
          stock: Number(p.stock),
        })),
      offers: business.combos
        .map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          price: c.price.toString(),
          imageUrl: c.imageUrl || null,
          stock: comboAvailableStock(c.items),
        }))
        .filter(c => c.stock > 0),
    },
  };
};

export default function StorefrontPage({
  businessName,
  businessSlug,
  heroTitle,
  heroSubtitle,
  heroImageUrl,
  primaryColor,
  backgroundColor,
  themeMode,
  logoUrl,
  aboutText,
  aboutImageUrl,
  products,
  offers,
}: StorefrontProps) {
  const isDark = themeMode === 'dark';
  const bgColor = backgroundColor || (isDark ? '#09090b' : '#f8fafc');
  const textColor = isDark ? '#fafafa' : '#0f172a';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const mutedText = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Checkout form
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Persist cart in localStorage
  const CART_KEY = `cart_${businessSlug}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Guard against an older cart shape (pre-offers) lingering in a
        // customer's browser — discard it rather than render broken items.
        if (Array.isArray(parsed) && parsed.every((i) => i && i.kind && i.id)) {
          setCart(parsed);
        }
      }
    } catch {}
  }, [CART_KEY]);
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, CART_KEY]);

  const addToCart = useCallback((kind: 'product' | 'combo', entry: Product | ComboOffer) => {
    setCart(prev => {
      const existing = prev.find(i => i.kind === kind && i.id === entry.id);
      if (existing) {
        if (existing.quantity >= entry.stock) return prev;
        return prev.map(i => i.kind === kind && i.id === entry.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { kind, id: entry.id, name: entry.name, price: entry.price, imageUrl: entry.imageUrl, stock: entry.stock, quantity: 1 }];
    });
    setCartOpen(true);
  }, []);

  const changeQty = (kind: 'product' | 'combo', id: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.kind === kind && i.id === id ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    );
  };

  const removeItem = (kind: 'product' | 'combo', id: string) => setCart(prev => prev.filter(i => !(i.kind === kind && i.id === id)));

  const cartTotal = cart.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Offers slider
  const offersScrollRef = useRef<HTMLDivElement>(null);
  const scrollOffers = (dir: 'left' | 'right') => {
    offersScrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
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
          items: cart.map(i => i.kind === 'combo'
            ? { comboId: i.id, quantity: i.quantity }
            : { productId: i.id, quantity: i.quantity }),
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
    <div style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Head>
        <title>{businessName} | Catálogo Online</title>
        <meta name="description" content={heroSubtitle} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </Head>

      {/* Cart Sidebar Overlay */}
      {cartOpen && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeCart}
          />
          {/* Slide-over panel */}
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md shadow-2xl flex flex-col"
            style={{ backgroundColor: isDark ? '#0f0f12' : '#ffffff', borderLeft: `1px solid ${borderColor}` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor }}>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" style={{ color: primaryColor }} />
                {step === 'success' ? '¡Pedido Enviado!' : step === 'checkout' ? 'Datos de Contacto' : `Mi Carrito (${cartCount})`}
              </h2>
              <button onClick={closeCart} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {step === 'success' && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full mb-6" style={{ backgroundColor: `${primaryColor}20` }}>
                    <CheckCircle className="h-10 w-10" style={{ color: primaryColor }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">¡Pedido Confirmado!</h3>
                  <p style={{ color: mutedText }} className="text-sm leading-relaxed">
                    Tu pedido fue enviado al local. Te contactarán pronto para coordinar la entrega o retiro.
                  </p>
                  <button
                    onClick={closeCart}
                    className="mt-8 rounded-xl px-8 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Continuar comprando
                  </button>
                </div>
              )}

              {step === 'cart' && (
                <>
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: mutedText }}>
                      <ShoppingBag className="h-16 w-16 mb-4 opacity-20" />
                      <p className="font-medium">Tu carrito está vacío</p>
                      <p className="text-sm mt-1">Agrega productos para continuar</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={`${item.kind}-${item.id}`} className="flex gap-4 rounded-xl p-3" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                          {/* Image */}
                          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                {item.kind === 'combo' ? <Gift className="h-8 w-8 opacity-20" /> : <Package className="h-8 w-8 opacity-20" />}
                              </div>
                            )}
                          </div>
                          {/* Details */}
                          <div className="flex flex-1 flex-col">
                            <p className="font-semibold text-sm leading-tight flex items-center gap-1.5">
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
                  )}
                </>
              )}

              {step === 'checkout' && (
                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4">
                  <p style={{ color: mutedText }} className="text-sm mb-2">Completa tus datos para enviar el pedido al local.</p>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nombre completo *</label>
                    <input
                      required
                      value={checkoutForm.name}
                      onChange={e => setCheckoutForm(f => ({...f, name: e.target.value}))}
                      placeholder="Juan García"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 transition-all"
                      style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: textColor }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email (opcional)</label>
                    <input
                      type="email"
                      value={checkoutForm.email}
                      onChange={e => setCheckoutForm(f => ({...f, email: e.target.value}))}
                      placeholder="juan@ejemplo.com"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 transition-all"
                      style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: textColor }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Teléfono (opcional)</label>
                    <input
                      type="tel"
                      value={checkoutForm.phone}
                      onChange={e => setCheckoutForm(f => ({...f, phone: e.target.value}))}
                      placeholder="+54 11 1234-5678"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 transition-all"
                      style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: textColor }}
                    />
                  </div>
                  {checkoutError && (
                    <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{checkoutError}</p>
                  )}
                  {/* Order summary */}
                  <div className="rounded-xl p-4 space-y-2 mt-4" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                    <p className="text-sm font-semibold mb-2">Resumen del pedido</p>
                    {cart.map(i => (
                      <div key={`${i.kind}-${i.id}`} className="flex justify-between text-sm" style={{ color: mutedText }}>
                        <span>{i.name} x{i.quantity}</span>
                        <span>${(Number(i.price) * i.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor }}>
                      <span>Total</span>
                      <span style={{ color: primaryColor }}>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            {step !== 'success' && (
              <div className="px-6 py-5 border-t space-y-3" style={{ borderColor }}>
                {step === 'cart' && (
                  <>
                    <div className="flex justify-between items-center text-sm" style={{ color: mutedText }}>
                      <span>Subtotal ({cartCount} items)</span>
                      <span className="text-lg font-black" style={{ color: textColor }}>${cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => setStep('checkout')}
                      disabled={cart.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-30"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Proceder al checkout
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                {step === 'checkout' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('cart')}
                      className="flex flex-1 items-center justify-center rounded-xl border py-3 text-sm font-medium hover:opacity-70 transition-all"
                      style={{ borderColor }}
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
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
        <div className="container mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3 text-2xl font-black tracking-tight" style={{ color: primaryColor }}>
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${primaryColor}20` }}>
                <Store className="h-6 w-6" />
              </div>
            )}
            {businessName}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black" style={{ color: primaryColor }}>
                {cartCount}
              </span>
            ) : null}
            Mi Carrito
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
        {heroImageUrl && (
          <div className="absolute inset-0 z-0">
            <img src={heroImageUrl} alt={businessName} className="h-full w-full object-cover opacity-20 blur-xl scale-105" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bgColor}, transparent)` }} />
          </div>
        )}
        <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center">
          <h1 className="mb-8 text-6xl font-black tracking-tighter sm:text-8xl">{heroTitle}</h1>
          <p className="mx-auto mb-12 max-w-2xl text-xl sm:text-2xl leading-relaxed" style={{ color: mutedText }}>{heroSubtitle}</p>
          <a
            href="#catalogo"
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${primaryColor}20` }}>
                  <Gift className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div>
                  <h2 className="flex flex-wrap items-center gap-2 text-3xl font-black tracking-tight">
                    Ofertas
                    <span className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: primaryColor }}>
                      Precio especial
                    </span>
                  </h2>
                  <p className="text-sm" style={{ color: mutedText }}>Combos armados a un precio más conveniente</p>
                </div>
              </div>
              <div className="hidden shrink-0 gap-2 sm:flex">
                <button
                  onClick={() => scrollOffers('left')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:opacity-70"
                  style={{ borderColor }}
                  aria-label="Ver ofertas anteriores"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => scrollOffers('right')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:opacity-70"
                  style={{ borderColor }}
                  aria-label="Ver más ofertas"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div ref={offersScrollRef} className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4">
              {offers.map(offer => {
                const inCart = cart.find(i => i.kind === 'combo' && i.id === offer.id);
                return (
                  <div
                    key={offer.id}
                    className="group relative flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-3xl border-2 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                    style={{ borderColor: primaryColor, backgroundColor: cardBg }}
                  >
                    <span
                      className="absolute left-4 top-4 z-10 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Oferta
                    </span>
                    <div className="aspect-square overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                      {offer.imageUrl ? (
                        <img src={offer.imageUrl} alt={offer.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Gift className="h-20 w-20 opacity-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-lg font-bold tracking-tight">{offer.name}</h3>
                      <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed" style={{ color: mutedText }}>{offer.description || 'Combo especial'}</p>
                      <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor }}>
                        <span className="text-xl font-black" style={{ color: primaryColor }}>${Number(offer.price).toFixed(2)}</span>
                        {inCart ? (
                          <div className="flex items-center gap-2 rounded-xl border px-2.5 py-1" style={{ borderColor }}>
                            <button onClick={() => changeQty('combo', offer.id, -1)} className="hover:opacity-70">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-5 text-center text-sm font-bold tabular-nums">{inCart.quantity}</span>
                            <button onClick={() => changeQty('combo', offer.id, 1)} disabled={inCart.quantity >= offer.stock} className="hover:opacity-70 disabled:opacity-30">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart('combo', offer)}
                            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-110"
                            style={{ backgroundColor: primaryColor }}
                          >
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

      {/* About Section */}
      {aboutText && (
        <section className="container mx-auto max-w-7xl px-6 py-20 border-b" style={{ borderColor }}>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold tracking-tight">Sobre Nosotros</h2>
              <p className="text-lg leading-relaxed whitespace-pre-line" style={{ color: mutedText }}>{aboutText}</p>
            </div>
            {aboutImageUrl && (
              <div className="relative aspect-video md:aspect-square overflow-hidden rounded-3xl shadow-2xl">
                <img src={aboutImageUrl} alt="Sobre Nosotros" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Products Grid */}
      <main id="catalogo" className="container mx-auto max-w-7xl px-6 py-20">
        <h2 className="mb-12 text-4xl font-bold tracking-tight">Productos</h2>
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border py-32" style={{ borderColor, backgroundColor: cardBg }}>
            <Package className="mb-6 h-20 w-20 opacity-20" />
            <p className="text-2xl font-medium" style={{ color: mutedText }}>Aún no hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map(product => {
              const inCart = cart.find(i => i.kind === 'product' && i.id === product.id);
              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                  style={{ borderColor, backgroundColor: cardBg }}
                >
                  {/* Image */}
                  <div className="aspect-square overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-24 w-24 opacity-10" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-xl font-bold tracking-tight">{product.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm flex-1 leading-relaxed" style={{ color: mutedText }}>{product.description || 'Sin descripción'}</p>
                    <div className="mt-6 flex items-center justify-between pt-4 border-t" style={{ borderColor }}>
                      <span className="text-2xl font-black" style={{ color: primaryColor }}>${Number(product.price).toFixed(2)}</span>
                      {inCart ? (
                        <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5" style={{ borderColor }}>
                          <button onClick={() => changeQty('product', product.id, -1)} className="hover:opacity-70">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold tabular-nums">{inCart.quantity}</span>
                          <button onClick={() => changeQty('product', product.id, 1)} disabled={inCart.quantity >= product.stock} className="hover:opacity-70 disabled:opacity-30">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart('product', product)}
                          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
                          style={{ backgroundColor: primaryColor }}
                        >
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
      <footer className="border-t py-12 text-center text-sm" style={{ borderColor, color: mutedText }}>
        <p className="font-medium">© {new Date().getFullYear()} {businessName}. Impulsado por MiNegocio SaaS.</p>
      </footer>
    </div>
  );
}
