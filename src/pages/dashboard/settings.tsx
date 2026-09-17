import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Settings, Save, Store, CreditCard, Palette, Globe, Printer } from 'lucide-react';
import { alertMessage, toastSuccess } from '@/lib/alerts';

export default function SettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Business states
  const [name, setName] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('0');
  const [shiftCutoffHour, setShiftCutoffHour] = useState('14');
  const [shiftMorningLabel, setShiftMorningLabel] = useState('Turno Mañana');
  const [shiftNightLabel, setShiftNightLabel] = useState('Turno Noche');
  const [ticketWidthMm, setTicketWidthMm] = useState('58');
  const [printTicketOnSale, setPrintTicketOnSale] = useState(true);

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
          setBusinessId(data.business.id);

          // Fetch business settings (currency, tax rate, turnos)
          const bsRes = await fetch('/api/business-settings', {
            headers: { 'x-business-id': data.business.id }
          });
          if (bsRes.ok) {
            const bsData = await bsRes.json();
            setCurrency(bsData.currency || 'USD');
            setTaxRate(String(bsData.taxRate ?? 0));
            setShiftCutoffHour(String(bsData.shiftCutoffHour ?? 14));
            setShiftMorningLabel(bsData.shiftMorningLabel || 'Turno Mañana');
            setShiftNightLabel(bsData.shiftNightLabel || 'Turno Noche');
            setTicketWidthMm(String(bsData.ticketWidthMm ?? 58));
            setPrintTicketOnSale(bsData.printTicketOnSale ?? true);
          }

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
    if (!businessId) return;
    setSaving(true);
    try {
      await fetch('/api/business-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-business-id': businessId },
        body: JSON.stringify({
          currency,
          taxRate: parseFloat(taxRate) || 0,
          shiftCutoffHour: parseInt(shiftCutoffHour, 10) || 0,
          shiftMorningLabel,
          shiftNightLabel,
          ticketWidthMm: parseInt(ticketWidthMm, 10) || 58,
          printTicketOnSale,
        }),
      });
      toastSuccess('Configuración guardada exitosamente');
    } catch (e) {
      console.error('Error saving business settings', e);
      alertMessage('Error guardando la configuración');
    } finally {
      setSaving(false);
    }
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
      toastSuccess('Diseño de la tienda actualizado');
    } catch (e) {
      console.error(e);
      alertMessage('Error guardando diseño');
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
                    <ImageUploadField
                      label="Logo (Opcional)"
                      value={sf.logoUrl}
                      onChange={(url) => setSf({ ...sf, logoUrl: url })}
                      businessId={business?.id || null}
                    />
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
                      <ImageUploadField
                        label="Imagen de Fondo"
                        value={sf.heroImageUrl}
                        onChange={(url) => setSf({ ...sf, heroImageUrl: url })}
                        businessId={business?.id || null}
                      />
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
                      <ImageUploadField
                        label='Imagen "Sobre Nosotros"'
                        value={sf.aboutImageUrl}
                        onChange={(url) => setSf({ ...sf, aboutImageUrl: url })}
                        businessId={business?.id || null}
                      />
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <div className="pt-4 border-t border-border/50">
                    <h3 className="mb-1 font-medium">Turnos (para el reporte por turno)</h3>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Definí la hora que separa el turno de la mañana del turno de la noche.
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Hora de corte</label>
                        <select
                          value={shiftCutoffHour}
                          onChange={(e) => setShiftCutoffHour(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Nombre turno mañana</label>
                        <input
                          value={shiftMorningLabel}
                          onChange={(e) => setShiftMorningLabel(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Nombre turno noche</label>
                        <input
                          value={shiftNightLabel}
                          onChange={(e) => setShiftNightLabel(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <h3 className="mb-1 font-medium flex items-center gap-2">
                      <Printer className="h-4 w-4 text-primary" />
                      Impresión de Tickets
                    </h3>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Ancho del papel de tu impresora térmica (58mm es el ancho posnet más común; 80mm es el otro tamaño habitual).
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Ancho del ticket</label>
                        <select
                          value={ticketWidthMm}
                          onChange={(e) => setTicketWidthMm(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus:ring-2 focus:ring-ring"
                        >
                          <option value="58">58mm (posnet)</option>
                          <option value="80">80mm</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={printTicketOnSale}
                            onChange={(e) => setPrintTicketOnSale(e.target.checked)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">Imprimir automáticamente al cerrar una venta</span>
                        </label>
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
