import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Save, Store, Layout, Type, Palette, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface StorefrontConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  primaryColor: string;
  themeMode: string;
}

export default function StoreBuilderPage() {
  const [config, setConfig] = useState<StorefrontConfig>({
    heroTitle: 'Bienvenido a nuestra tienda',
    heroSubtitle: 'Los mejores productos al mejor precio',
    heroImageUrl: '',
    primaryColor: '#3b82f6',
    themeMode: 'dark',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessData, setBusinessData] = useState<{ id: string; slug: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Fetch current user's business
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const { business } = await meRes.json();
        setBusinessData({ id: business.id, slug: business.slug });

        // Fetch storefront config using actual businessId
        const res = await fetch('/api/storefront', {
          headers: { 'x-business-id': business.id },
        });
        if (res.ok) {
          const data = await res.json();
          setConfig({
            heroTitle: data.heroTitle || '',
            heroSubtitle: data.heroSubtitle || '',
            heroImageUrl: data.heroImageUrl || '',
            primaryColor: data.primaryColor || '#3b82f6',
            themeMode: data.themeMode || 'dark',
          });
        }
      } catch (e) {
        console.error('Error fetching storefront config', e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!businessData) return;
    setSaving(true);
    try {
      await fetch('/api/storefront', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessData.id },
        body: JSON.stringify(config),
      });
      alert('Configuración guardada exitosamente');
    } catch (e) {
      console.error('Error saving config', e);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof StorefrontConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Creador de Tienda</h1>
          <p className="mt-1 text-muted-foreground">Personaliza el diseño de tu catálogo público</p>
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
            disabled={saving || loading}
            className="flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar Cambios
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Settings Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Type className="h-5 w-5 text-primary" /> Textos Principales
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Título Principal (Hero)</label>
                <input
                  type="text"
                  value={config.heroTitle}
                  onChange={(e) => handleChange('heroTitle', e.target.value)}
                  placeholder="El nombre de tu tienda"
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Subtítulo (Slogan)</label>
                <input
                  type="text"
                  value={config.heroSubtitle}
                  onChange={(e) => handleChange('heroSubtitle', e.target.value)}
                  placeholder="Tu propuesta de valor"
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Palette className="h-5 w-5 text-primary" /> Apariencia
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Color Principal</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm uppercase focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tema Base</label>
                <select
                  value={config.themeMode}
                  onChange={(e) => handleChange('themeMode', e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro (Recomendado)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <ImageIcon className="h-5 w-5 text-primary" /> Imagen de Portada
            </h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium">URL de la imagen (Hero)</label>
              <input
                type="text"
                value={config.heroImageUrl}
                onChange={(e) => handleChange('heroImageUrl', e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Pega un link a tu imagen de portada (opcional).</p>
            </div>
          </div>
        </div>

        {/* Live Preview Pane */}
        <div className="col-span-12 lg:col-span-8">
          <div className="sticky top-24 flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
            {/* Browser chrome */}
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 bg-muted/30 px-4">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
              </div>
              <div className="mx-auto rounded bg-background px-4 py-1 text-xs text-muted-foreground">
                localhost:3000/{businessData?.slug || '...'}
              </div>
            </div>

            {/* Preview Canvas */}
            <div 
              className="flex-1 overflow-y-auto"
              style={{
                backgroundColor: config.themeMode === 'dark' ? '#09090b' : '#ffffff',
                color: config.themeMode === 'dark' ? '#fafafa' : '#09090b',
                minHeight: '600px'
              }}
            >
              {/* Fake Store Navbar */}
              <div className="flex items-center justify-between border-b border-border/20 px-6 py-4">
                <div className="flex items-center gap-2 font-bold" style={{ color: config.primaryColor }}>
                  <Store className="h-6 w-6" />
                  MiNegocio Demo
                </div>
                <div className="flex gap-4 text-sm opacity-70">
                  <span>Productos</span>
                  <span>Contacto</span>
                </div>
              </div>

              {/* Fake Hero */}
              <div className="relative flex flex-col items-center justify-center py-24 text-center px-4">
                {config.heroImageUrl && (
                  <div className="absolute inset-0 z-0 overflow-hidden opacity-30 blur-sm">
                    <img src={config.heroImageUrl} alt="Background" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90" />
                  </div>
                )}
                <div className="relative z-10 max-w-2xl">
                  <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                    {config.heroTitle || 'Tu Título Aquí'}
                  </h1>
                  <p className="text-lg opacity-80 sm:text-xl">
                    {config.heroSubtitle || 'Tu subtítulo y propuesta de valor aquí.'}
                  </p>
                  <div className="mt-8">
                    <button 
                      className="rounded-full px-8 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      Ver Catálogo
                    </button>
                  </div>
                </div>
              </div>

              {/* Fake Product Grid */}
              <div className="px-6 py-12">
                <h3 className="mb-6 text-2xl font-bold">Nuestros Productos</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-border/20 p-4 transition-all hover:border-border/40 hover:shadow-lg">
                      <div className="mb-3 aspect-square rounded-lg bg-muted/20" />
                      <h4 className="font-semibold">Producto Demo {i}</h4>
                      <p className="text-sm opacity-70" style={{ color: config.primaryColor }}>$19.99</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
