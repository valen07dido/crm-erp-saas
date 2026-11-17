import type { AssetRecord, AudienceKey, BrandKit } from './types';

/**
 * Single source of truth for what Marketing Studio is allowed to say about
 * WALTI. Every generated text (motor or IA) is built only from these facts.
 *
 * Rules that apply everywhere:
 * - No invented clients, testimonials, integrations, results, prices or data.
 * - WALTI organizes information and produces statistics; it does not "do the
 *   work for you" or act autonomously.
 * - Prices, discounts, quotas and conditions only appear when the team types
 *   them into a campaign/promo — never generated.
 */

export const BRAND = {
  graphite: '#20252B',
  ivory: '#F5F1E9',
  white: '#FFFFFF',
  lime: '#D6F36A',
  petroleum: '#3D9488',
  charcoal: '#252B32',
  muted: '#5A6268',
} as const;

export const DEFAULT_BRAND_KIT: BrandKit = {
  colors: [
    { name: 'Grafito', hex: BRAND.graphite, role: 'Base / fondos oscuros' },
    { name: 'Marfil', hex: BRAND.ivory, role: 'Fondos claros' },
    { name: 'Blanco', hex: BRAND.white, role: 'Superficies' },
    { name: 'Verde lima', hex: BRAND.lime, role: 'Acento (relleno, nunca texto sobre claro)' },
    { name: 'Verde petróleo', hex: BRAND.petroleum, role: 'Acento secundario' },
  ],
  whatsapp: '+54 3413164761',
  cta: 'Solicitá una demostración personalizada',
  instagram: '',
  website: '',
  tagline: 'Gestión comercial para pymes y comercios',
};

/** "+54 3413164761" → "+54 341 316-4761" for pieces; digits-only for wa.me links. */
export function formatWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('54')) {
    return `+54 ${digits.slice(2, 5)} ${digits.slice(5, 8)}-${digits.slice(8)}`;
  }
  return raw.trim();
}

export function whatsappLink(raw: string, text?: string): string {
  const digits = raw.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** The original logo files shipped with the app. Never recolored or distorted. */
export const BUILTIN_LOGOS: AssetRecord[] = [
  {
    id: 'builtin-wordmark',
    name: 'Logotipo "walti" (azul)',
    category: 'logo',
    url: '/logo-sidebar.png',
    mimeType: 'image/png',
    width: 948,
    height: 312,
    tags: ['original', 'fondo claro'],
    createdAt: '2026-01-01T00:00:00.000Z',
    builtIn: true,
  },
  {
    id: 'builtin-mascot',
    name: 'Logo con mascota',
    category: 'logo',
    url: '/logo-login.png',
    mimeType: 'image/png',
    width: 392,
    height: 299,
    tags: ['original', 'baja resolución'],
    createdAt: '2026-01-01T00:00:00.000Z',
    builtIn: true,
  },
  {
    id: 'builtin-isotipo',
    name: 'Isotipo W',
    category: 'logo',
    url: '/favicon.png',
    mimeType: 'image/png',
    width: 512,
    height: 512,
    tags: ['original'],
    createdAt: '2026-01-01T00:00:00.000Z',
    builtIn: true,
  },
];

export interface Feature {
  key: string;
  name: string;
  /** One modest, verifiable sentence. */
  fact: string;
  /** What a real screen recording/screenshot of this module would show. */
  screen: string;
  pain: string;
  /**
   * Listed in the commercial brief but not found in the current codebase
   * (Product has no cost field; currency is a single per-business setting).
   * Never selected by default; the UI asks to confirm before publishing.
   */
  needsConfirmation?: boolean;
}

export const FEATURES: Feature[] = [
  {
    key: 'gestion',
    name: 'Gestión comercial',
    fact: 'Productos, clientes, ventas, compras, caja y gastos en un mismo sistema.',
    screen: 'el panel principal de WALTI',
    pain: 'tener la información repartida entre cuadernos, planillas y mensajes',
  },
  {
    key: 'productos',
    name: 'Productos',
    fact: 'Cargás tus productos con su precio y su stock.',
    screen: 'el listado de Productos',
    pain: 'no saber qué hay en stock sin ir a contar',
  },
  {
    key: 'clientes',
    name: 'Clientes',
    fact: 'Tenés tu cartera de clientes organizada en un solo lugar.',
    screen: 'la sección Clientes',
    pain: 'buscar datos de clientes en el celular o en papelitos',
  },
  {
    key: 'ventas',
    name: 'Ventas',
    fact: 'Cada venta queda registrada y la podés consultar cuando la necesites.',
    screen: 'el registro de Ventas',
    pain: 'cerrar el día sin saber bien cuánto se vendió',
  },
  {
    key: 'pos',
    name: 'Punto de venta',
    fact: 'Un punto de venta para cobrar desde el mostrador, con lector de código de barras.',
    screen: 'el Punto de Venta cargando un producto',
    pain: 'anotar cada venta a mano mientras atendés',
  },
  {
    key: 'compras',
    name: 'Compras y proveedores',
    fact: 'Registrás tus compras y tenés a tus proveedores ordenados.',
    screen: 'la sección Compras',
    pain: 'perder el rastro de lo que le compraste a cada proveedor',
  },
  {
    key: 'caja',
    name: 'Caja',
    fact: 'Ves los movimientos de caja de tu negocio.',
    screen: 'la pantalla de Caja',
    pain: 'que la caja no cierre y no saber por qué',
  },
  {
    key: 'gastos',
    name: 'Gastos',
    fact: 'Registrás tus gastos para saber en qué se va la plata.',
    screen: 'la sección Gastos',
    pain: 'gastos chicos que se pierden y nadie anota',
  },
  {
    key: 'estadisticas',
    name: 'Estadísticas',
    fact: 'WALTI arma estadísticas con tus datos para que veas cómo viene el negocio.',
    screen: 'el Dashboard con las estadísticas',
    pain: 'decidir a ojo porque los números no están a mano',
  },
  {
    key: 'margenes',
    name: 'Costos y márgenes en ARS/USD',
    fact: 'Ves costos y márgenes en pesos y en dólares.',
    screen: 'un producto con su costo y margen',
    pain: 'no saber cuánto le ganás de verdad a cada producto',
    needsConfirmation: true,
  },
  {
    key: 'ofertas',
    name: 'Ofertas',
    fact: 'Armás y administrás ofertas para tus productos.',
    screen: 'la sección Ofertas',
    pain: 'promociones que se arman a último momento y sin control',
  },
  {
    key: 'tienda',
    name: 'Página pública de productos',
    fact: 'Tenés una página pública con tus productos, personalizable con tu marca.',
    screen: 'la página pública de un negocio',
    pain: 'mandar fotos y precios uno por uno por WhatsApp',
  },
];

export const FEATURE_MAP: Record<string, Feature> = Object.fromEntries(FEATURES.map((f) => [f.key, f]));

export interface Audience {
  key: AudienceKey;
  label: string;
  /** "tu comercio", "tu distribuidora"… */
  biz: string;
  /** Plural noun for headlines: "comercios", "distribuidoras"… */
  plural: string;
}

export const AUDIENCES: Audience[] = [
  { key: 'general', label: 'Pymes y comercios (general)', biz: 'tu negocio', plural: 'negocios' },
  { key: 'minorista', label: 'Comercios minoristas', biz: 'tu comercio', plural: 'comercios' },
  { key: 'distribuidora', label: 'Distribuidoras', biz: 'tu distribuidora', plural: 'distribuidoras' },
  { key: 'emprendedor', label: 'Emprendedores', biz: 'tu emprendimiento', plural: 'emprendimientos' },
  { key: 'pyme', label: 'Pymes', biz: 'tu pyme', plural: 'pymes' },
];

export const AUDIENCE_MAP: Record<AudienceKey, Audience> = Object.fromEntries(
  AUDIENCES.map((a) => [a.key, a]),
) as Record<AudienceKey, Audience>;

export const CHANNELS = ['Instagram', 'Facebook', 'WhatsApp', 'Presentación comercial'];
