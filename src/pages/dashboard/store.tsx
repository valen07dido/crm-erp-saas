import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { StorefrontView, StorefrontProduct, StorefrontOffer } from '@/components/storefront/storefront-view';
import { FONT_PAIRINGS } from '@/lib/storefront-fonts';
import { alertMessage, toastSuccess } from '@/lib/alerts';
import {
  Save, ExternalLink, Palette, Image as ImageIcon, Info, Phone, Package2,
  Monitor, Tablet, Smartphone, CheckCircle2, ChevronDown, Type as TypeIcon,
  LayoutGrid, Compass, Sparkles,
} from 'lucide-react';

interface StudioConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  themeMode: string;
  fontPairing: string;
  buttonStyle: string;
  faviconUrl: string;
  logoUrl: string;
  aboutText: string;
  aboutImageUrl: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  whatsappNumber: string;
}

const DEFAULT_CONFIG: StudioConfig = {
  heroTitle: 'Bienvenido a nuestra tienda',
  heroSubtitle: 'Los mejores productos al mejor precio',
  heroImageUrl: '',
  primaryColor: '#3b82f6',
  secondaryColor: '#3D9488',
  backgroundColor: '#09090b',
  themeMode: 'dark',
  fontPairing: 'walti',
  buttonStyle: 'rounded',
  faviconUrl: '',
  logoUrl: '',
  aboutText: '',
  aboutImageUrl: '',
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
  whatsappNumber: '',
};

const DEVICE_WIDTHS: Record<'desktop' | 'tablet' | 'mobile', string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

const BUTTON_STYLES: { key: string; label: string }[] = [
  { key: 'rounded', label: 'Redondeado' },
  { key: 'pill', label: 'Píldora' },
  { key: 'square', label: 'Cuadrado' },
];

const SECTIONS = [
  { key: 'identidad', label: 'Identidad de marca', icon: Sparkles },
  { key: 'apariencia', label: 'Diseño y apariencia', icon: Palette },
  { key: 'portada', label: 'Portada', icon: ImageIcon },
  { key: 'navegacion', label: 'Navegación', icon: Compass },
  { key: 'secciones', label: 'Secciones de contenido', icon: Info },
  { key: 'catalogo', label: 'Catálogo de productos', icon: Package2 },
  { key: 'comercial', label: 'Información comercial', icon: Phone },
] as const;

export default function StoreBuilderPage() {
  const router = useRouter();
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<StudioConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessData, setBusinessData] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [offers, setOffers] = useState<StorefrontOffer[]>([]);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [openSection, setOpenSection] = useState<string>('identidad');

  const isDirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedConfig), [config, savedConfig]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const { business } = await meRes.json();
        setBusinessData({ id: business.id, name: business.name, slug: business.slug });

        const [sfRes, prodRes, comboRes] = await Promise.all([
          fetch('/api/storefront', { headers: { 'x-business-id': business.id } }),
          fetch('/api/products', { headers: { 'x-business-id': business.id } }),
          fetch('/api/combos', { headers: { 'x-business-id': business.id } }),
        ]);

        if (sfRes.ok) {
          const data = await sfRes.json();
          const loaded: StudioConfig = {
            heroTitle: data.heroTitle || '',
            heroSubtitle: data.heroSubtitle || '',
            heroImageUrl: data.heroImageUrl || '',
            primaryColor: data.primaryColor || '#3b82f6',
            secondaryColor: data.secondaryColor || '#3D9488',
            backgroundColor: data.backgroundColor || (data.themeMode === 'light' ? '#f8fafc' : '#09090b'),
            themeMode: data.themeMode || 'dark',
            fontPairing: data.fontPairing || 'walti',
            buttonStyle: data.buttonStyle || 'rounded',
            faviconUrl: data.faviconUrl || '',
            logoUrl: data.logoUrl || '',
            aboutText: data.aboutText || '',
            aboutImageUrl: data.aboutImageUrl || '',
            contactPhone: data.contactPhone || '',
            contactEmail: data.contactEmail || '',
            contactAddress: data.contactAddress || '',
            whatsappNumber: data.whatsappNumber || '',
          };
          setConfig(loaded);
          setSavedConfig(loaded);
        }

        if (prodRes.ok) {
          const list = await prodRes.json();
          setProducts(
            list
              .filter((p: any) => Number(p.stock) > 0)
              .map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: String(p.price),
                imageUrl: p.imageUrl || null,
                stock: Number(p.stock),
                category: p.category || null,
              }))
          );
        }
        if (comboRes.ok) {
          const list = await comboRes.json();
          setOffers(
            list
              .filter((c: any) => c.isActive)
              .map((c: any) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                price: String(c.price),
                imageUrl: c.imageUrl || null,
                stock: 99, // preview only — real stock math lives on the public page
              }))
          );
        }
      } catch (e) {
        console.error('Error fetching storefront config', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Warn before losing unsaved changes — tab close/refresh...
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ...and in-app navigation to another page.
  useEffect(() => {
    const handleRouteChange = () => {
      if (isDirty && !window.confirm('Tenés cambios sin guardar en tu tienda. ¿Salir de todos modos?')) {
        router.events.emit('routeChangeError');
        // eslint-disable-next-line no-throw-literal
        throw 'routeChange aborted (unsaved storefront changes)';
      }
    };
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [isDirty, router.events]);

  const handleSave = async () => {
    if (!businessData) return;
    setSaving(true);
    try {
      const res = await fetch('/api/storefront', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessData.id },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('save failed');
      setSavedConfig(config);
      toastSuccess('Tu tienda fue actualizada y ya está publicada');
    } catch (e) {
      console.error('Error saving config', e);
      alertMessage('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof StudioConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const previewConfig = {
    ...config,
    heroImageUrl: config.heroImageUrl || null,
    backgroundColor: config.backgroundColor || null,
    faviconUrl: config.faviconUrl || null,
    logoUrl: config.logoUrl || null,
    aboutText: config.aboutText || null,
    aboutImageUrl: config.aboutImageUrl || null,
    contactPhone: config.contactPhone || null,
    contactEmail: config.contactEmail || null,
    contactAddress: config.contactAddress || null,
    whatsappNumber: config.whatsappNumber || null,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Walti Studio</p>
          <h1 className="font-heading text-3xl font-bold">{businessData?.name || 'Tu tienda'}</h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {isDirty ? (
              <>
                <span className="h-2 w-2 rounded-full bg-warning" />
                Tenés cambios sin guardar
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                Todo guardado y publicado
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <a
            href={businessData ? `/${businessData.slug}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" />
            Ver Tienda
          </a>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-95 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cambios
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Settings Panel */}
        <div className="col-span-12 space-y-3 lg:col-span-5 xl:col-span-4">
          {SECTIONS.map(({ key, label, icon: Icon }) => {
            const open = openSection === key;
            return (
              <div key={key} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <button
                  onClick={() => setOpenSection(open ? '' : key)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/50"
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <Icon className="h-4 w-4 text-secondary" />
                    {label}
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="animate-fade-in space-y-4 border-t border-border px-5 py-5">
                    {key === 'identidad' && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          El nombre y la URL de tu tienda se configuran en Configuración → Información del Negocio.
                        </p>
                        <ImageUploadField
                          label="Logo (aparece en la barra de navegación)"
                          value={config.logoUrl}
                          onChange={(url) => handleChange('logoUrl', url)}
                          businessId={businessData?.id || null}
                        />
                        <ImageUploadField
                          label="Favicon (ícono de la pestaña del navegador)"
                          value={config.faviconUrl}
                          onChange={(url) => handleChange('faviconUrl', url)}
                          businessId={businessData?.id || null}
                          hint="Cuadrado, ideal 64x64px o más. Si lo dejás vacío, el navegador usa uno genérico."
                        />
                      </>
                    )}

                    {key === 'apariencia' && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Color Principal</label>
                          <div className="flex gap-2">
                            <input type="color" value={config.primaryColor} onChange={(e) => handleChange('primaryColor', e.target.value)} className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent p-0" />
                            <input type="text" value={config.primaryColor} onChange={(e) => handleChange('primaryColor', e.target.value)} className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm uppercase focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Botones, precios y acentos principales.</p>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Color Secundario</label>
                          <div className="flex gap-2">
                            <input type="color" value={config.secondaryColor} onChange={(e) => handleChange('secondaryColor', e.target.value)} className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent p-0" />
                            <input type="text" value={config.secondaryColor} onChange={(e) => handleChange('secondaryColor', e.target.value)} className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm uppercase focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Ofertas, categorías y detalles secundarios.</p>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Color de Fondo</label>
                          <div className="flex gap-2">
                            <input type="color" value={config.backgroundColor} onChange={(e) => handleChange('backgroundColor', e.target.value)} className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent p-0" />
                            <input type="text" value={config.backgroundColor} onChange={(e) => handleChange('backgroundColor', e.target.value)} className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm uppercase focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Tema Base</label>
                          <select value={config.themeMode} onChange={(e) => handleChange('themeMode', e.target.value)} className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20">
                            <option value="light">Claro</option>
                            <option value="dark">Oscuro</option>
                          </select>
                          <p className="mt-1.5 text-xs text-muted-foreground">Define si el texto y los bordes son claros u oscuros — ajustá el Color de Fondo para que combine.</p>
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><TypeIcon className="h-3.5 w-3.5" /> Tipografía</label>
                          <div className="space-y-2">
                            {FONT_PAIRINGS.map((p) => (
                              <button
                                key={p.key}
                                onClick={() => handleChange('fontPairing', p.key)}
                                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${config.fontPairing === p.key ? 'border-primary bg-primary/10' : 'border-input hover:bg-accent'}`}
                              >
                                <span className="font-semibold" style={{ fontFamily: p.headingVar }}>{p.label}</span>
                                <span className="block text-xs text-muted-foreground">{p.sample}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><LayoutGrid className="h-3.5 w-3.5" /> Estilo de botones</label>
                          <div className="grid grid-cols-3 gap-2">
                            {BUTTON_STYLES.map((b) => (
                              <button
                                key={b.key}
                                onClick={() => handleChange('buttonStyle', b.key)}
                                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${config.buttonStyle === b.key ? 'border-primary bg-primary/10' : 'border-input hover:bg-accent'}`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {key === 'portada' && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Título Principal (Hero)</label>
                          <input type="text" value={config.heroTitle} onChange={(e) => handleChange('heroTitle', e.target.value)} placeholder="El nombre de tu tienda" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Subtítulo (Slogan)</label>
                          <input type="text" value={config.heroSubtitle} onChange={(e) => handleChange('heroSubtitle', e.target.value)} placeholder="Tu propuesta de valor" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <ImageUploadField label="Imagen de Portada" value={config.heroImageUrl} onChange={(url) => handleChange('heroImageUrl', url)} businessId={businessData?.id || null} />
                      </>
                    )}

                    {key === 'navegacion' && (
                      <p className="text-sm text-muted-foreground">
                        El menú se arma solo, según lo que completes: "Productos" siempre aparece, "Nosotros" aparece si
                        cargás texto en Secciones de contenido, y "Contacto" aparece si cargás algún dato en Información
                        comercial. No hay nada que configurar acá todavía.
                      </p>
                    )}

                    {key === 'secciones' && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">
                            Texto "Sobre Nosotros" <span className="text-xs font-normal text-muted-foreground">(vacío = oculta la sección)</span>
                          </label>
                          <textarea value={config.aboutText} onChange={(e) => handleChange('aboutText', e.target.value)} placeholder="Contá quiénes son, hace cuánto están, qué los distingue..." rows={5} className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <ImageUploadField label="Imagen (Opcional)" value={config.aboutImageUrl} onChange={(url) => handleChange('aboutImageUrl', url)} businessId={businessData?.id || null} />
                      </>
                    )}

                    {key === 'catalogo' && (
                      <div className="space-y-3 text-sm">
                        <p className="text-muted-foreground">
                          Los productos y ofertas se cargan desde Productos y Ofertas — acá solo se define cómo se ven.
                        </p>
                        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                          <span>Productos visibles en la tienda</span>
                          <span className="font-mono font-semibold">{products.length}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                          <span>Ofertas activas</span>
                          <span className="font-mono font-semibold">{offers.length}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Un producto solo aparece acá si tiene stock disponible. Los clientes pueden buscar por nombre y
                          filtrar por categoría automáticamente si tus productos tienen categoría asignada.
                        </p>
                      </div>
                    )}

                    {key === 'comercial' && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Teléfono</label>
                          <input type="text" value={config.contactPhone} onChange={(e) => handleChange('contactPhone', e.target.value)} placeholder="011 1234-5678" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">WhatsApp</label>
                          <input type="text" value={config.whatsappNumber} onChange={(e) => handleChange('whatsappNumber', e.target.value)} placeholder="5491112345678 (con código de país, sin +)" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Email</label>
                          <input type="email" value={config.contactEmail} onChange={(e) => handleChange('contactEmail', e.target.value)} placeholder="contacto@tunegocio.com" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">Dirección</label>
                          <input type="text" value={config.contactAddress} onChange={(e) => handleChange('contactAddress', e.target.value)} placeholder="Av. Siempre Viva 742" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <p className="text-xs text-muted-foreground">Dejá en blanco lo que no quieras mostrar — el pie de página solo muestra lo que completes.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Preview */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8">
          <div className="sticky top-24 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="truncate text-xs text-muted-foreground">walti.com.ar/{businessData?.slug || '...'}</span>
              <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
                {([
                  { key: 'desktop', icon: Monitor },
                  { key: 'tablet', icon: Tablet },
                  { key: 'mobile', icon: Smartphone },
                ] as const).map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setDevice(key)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${device === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                    title={key}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto bg-muted/20 p-4">
              <div
                className="mx-auto overflow-hidden rounded-lg shadow-xl transition-all duration-300"
                style={{ width: DEVICE_WIDTHS[device], maxWidth: '100%' }}
              >
                <StorefrontView
                  businessName={businessData?.name || 'Tu Negocio'}
                  businessSlug={businessData?.slug || 'preview'}
                  config={previewConfig}
                  products={products}
                  offers={offers}
                  interactive={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
