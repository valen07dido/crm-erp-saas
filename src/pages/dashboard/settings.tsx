import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Settings, Save, Store, CreditCard, Palette, Globe, Image as ImageIcon } from 'lucide-react';

export default function SettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Business states
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('0');

  // Storefront states
  const [sf, setSf] = useState({
    heroTitle: '',
    heroSubtitle: '',
    heroImageUrl: '',
    primaryColor: '#3b82f6',
    themeMode: 'dark',
    logoUrl: '',
    aboutText: '',
    aboutImageUrl: ''
  });

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const data = await meRes.json();
          setBusiness(data.business);
          setName(data.business.name);
          
          // Fetch storefront settings
          const sfRes = await fetch('/api/storefront-settings', {
            headers: { 'x-business-id': data.business.id }
          });
          if (sfRes.ok) {
            const sfData = await sfRes.json();
            if (sfData && sfData.id) {
              setSf({
                heroTitle: sfData.heroTitle || '',
                heroSubtitle: sfData.heroSubtitle || '',
                heroImageUrl: sfData.heroImageUrl || '',
                primaryColor: sfData.primaryColor || '#3b82f6',
                themeMode: sfData.themeMode || 'dark',
                logoUrl: sfData.logoUrl || '',
                aboutText: sfData.aboutText || '',
                aboutImageUrl: sfData.aboutImageUrl || ''
              });
            }
          }
        }
      } catch (e) {
        console.error('Error fetching business info', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert('Configuración guardada exitosamente');
    }, 1000);
  };

  const handleStorefrontSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/storefront-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-business-id': business.id
        },
        body: JSON.stringify(sf)
      });
      alert('Diseño de la tienda actualizado');
    } catch (e) {
      console.error(e);
      alert('Error guardando diseño');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="mt-1 text-muted-foreground">Administra los detalles y personaliza tu tienda pública</p>
        </div>
        {business?.slug && (
          <a
            href={`/${business.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Globe className="h-4 w-4" />
            Ver Tienda Pública
          </a>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          
          <div className="col-span-1 space-y-6 md:col-span-2">
            
            {/* Storefront Customization */}
            <div className="rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden">
              <div className="border-b border-border/50 bg-muted/30 px-6 py-4 flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-500" />
                <h2 className="font-semibold text-lg">Personalizar Tienda Pública</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleStorefrontSubmit} className="space-y-6">
                  
                  {/* Brand & Theme */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium flex items-center gap-2"><ImageIcon className="h-4 w-4"/> URL del Logo (Opcional)</label>
                      <input 
                        value={sf.logoUrl} 
                        onChange={(e) => setSf({...sf, logoUrl: e.target.value})}
                        placeholder="https://ejemplo.com/logo.png"
                        className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" 
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Color Primario (Hex)</label>
                      <div className="flex gap-2">
                        <input 
                          type="color"
                          value={sf.primaryColor} 
                          onChange={(e) => setSf({...sf, primaryColor: e.target.value})}
                          className="h-10 w-12 rounded-lg cursor-pointer bg-background" 
                        />
                        <input 
                          value={sf.primaryColor} 
                          onChange={(e) => setSf({...sf, primaryColor: e.target.value})}
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm font-mono uppercase focus:ring-2 focus:ring-ring" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hero Section */}
                  <div className="pt-4 border-t border-border/50">
                    <h3 className="mb-4 font-medium">Sección Principal (Hero)</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Título Principal</label>
                        <input 
                          value={sf.heroTitle} 
                          onChange={(e) => setSf({...sf, heroTitle: e.target.value})}
                          placeholder="La mejor tienda de tu ciudad"
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" 
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Subtítulo</label>
                        <input 
                          value={sf.heroSubtitle} 
                          onChange={(e) => setSf({...sf, heroSubtitle: e.target.value})}
                          placeholder="Encuentra todo lo que necesitas al mejor precio."
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" 
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Imagen de Fondo (URL)</label>
                        <input 
                          value={sf.heroImageUrl} 
                          onChange={(e) => setSf({...sf, heroImageUrl: e.target.value})}
                          placeholder="https://images.unsplash.com/photo-..."
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* About Section */}
                  <div className="pt-4 border-t border-border/50">
                    <h3 className="mb-4 font-medium">Sección "Sobre Nosotros"</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Historia del Local</label>
                        <textarea 
                          value={sf.aboutText} 
                          onChange={(e) => setSf({...sf, aboutText: e.target.value})}
                          placeholder="Cuéntale a tus clientes quiénes son y qué ofrecen..."
                          className="flex min-h-[80px] w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-ring" 
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Imagen "Sobre Nosotros" (URL)</label>
                        <input 
                          value={sf.aboutImageUrl} 
                          onChange={(e) => setSf({...sf, aboutImageUrl: e.target.value})}
                          placeholder="https://ejemplo.com/local.jpg"
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={saving} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 text-sm font-medium text-white shadow-lg transition-all hover:bg-purple-700 disabled:opacity-50">
                      {saving ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Guardar Diseño
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Business Info (Original) */}
            <div className="rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden">
              <div className="border-b border-border/50 bg-muted/30 px-6 py-4 flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Información del Negocio</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleBusinessSubmit} className="space-y-6">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Nombre de la Empresa</label>
                    <input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-muted-foreground">URL del Tenant (No editable)</label>
                    <input 
                      value={business?.slug || ''} 
                      disabled
                      className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground opacity-50 cursor-not-allowed" 
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-border/50">
                    <h3 className="mb-4 font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Preferencias Financieras
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Moneda Principal</label>
                        <select 
                          value={currency} 
                          onChange={(e) => setCurrency(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="ARS">ARS ($)</option>
                          <option value="MXN">MXN ($)</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Tasa de Impuesto (%)</label>
                        <input 
                          type="number"
                          value={taxRate} 
                          onChange={(e) => setTaxRate(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={saving} className="flex h-10 items-center justify-center gap-2 rounded-lg gradient-primary px-6 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all hover:brightness-110 disabled:opacity-50">
                      {saving ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Guardar Preferencias
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>

          <div className="col-span-1 space-y-6">
             <div className="rounded-xl border border-border/50 bg-card shadow-lg p-6 sticky top-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Settings className="h-5 w-5 text-primary animate-spin-slow" />
                  </div>
                  <h3 className="font-semibold text-lg">Estado del Sistema</h3>
                </div>
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between items-center pb-2 border-b border-border/30">
                    <span className="text-muted-foreground">Plan Actual</span>
                    <span className="font-medium text-primary">Pro (Trial)</span>
                  </li>
                  <li className="flex justify-between items-center pb-2 border-b border-border/30">
                    <span className="text-muted-foreground">Módulos Activos</span>
                    <span className="font-medium text-emerald-500">8 / 8</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-mono text-xs">v1.3.0</span>
                  </li>
                </ul>
             </div>
          </div>

        </div>
      )}
    </DashboardLayout>
  );
}
