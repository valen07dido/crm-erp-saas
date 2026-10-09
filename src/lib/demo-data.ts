// Seed data for Walti's "Probar Walti" sandbox demo. Everything here is fake
// and lives only in the visitor's own browser (localStorage) — see demo-mode.ts.

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export interface DemoProduct {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  price: string;
  stock: string;
  imageUrl: string | null;
  barcode: string | null;
  expirationDate: string | null;
  soldByWeight: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
}

export interface DemoComboItem {
  id: string;
  comboId: string;
  productId: string;
  quantity: string;
}

export interface DemoCombo {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  barcode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: DemoComboItem[];
}

export interface DemoClient {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoSupplier {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoSaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  comboId: string | null;
  quantity: string;
  price: string;
}

export interface DemoSale {
  id: string;
  businessId: string;
  clientId: string | null;
  total: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: DemoSaleItem[];
}

export interface DemoPurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  quantity: string;
  price: string;
}

export interface DemoPurchase {
  id: string;
  businessId: string;
  supplierId: string | null;
  total: string;
  createdAt: string;
  updatedAt: string;
  items: DemoPurchaseItem[];
}

export interface DemoTransaction {
  id: string;
  businessId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string | null;
  category: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoBusinessUser {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: { id: string; email: string; username: string | null; name: string | null };
}

export interface DemoDb {
  business: {
    id: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: null;
    name: string;
    slug: string;
    logoUrl: string | null;
    isActive: boolean;
    planName: string;
    planExpiresAt: null;
    ownerId: string;
  };
  businessSettings: {
    id: string;
    businessId: string;
    currency: string;
    taxRate: number;
    shiftMorningStartHour: number;
    shiftMorningEndHour: number;
    shiftNightStartHour: number;
    shiftNightEndHour: number;
    shiftMorningLabel: string;
    shiftNightLabel: string;
    ticketWidthMm: number;
    printTicketOnSale: boolean;
  };
  storefront: {
    id: string;
    businessId: string;
    heroTitle: string;
    heroSubtitle: string;
    heroImageUrl: string | null;
    primaryColor: string;
    themeMode: string;
    logoUrl: string | null;
    aboutText: string | null;
    aboutImageUrl: string | null;
  };
  products: DemoProduct[];
  combos: DemoCombo[];
  clients: DemoClient[];
  suppliers: DemoSupplier[];
  sales: DemoSale[];
  purchases: DemoPurchase[];
  transactions: DemoTransaction[];
  businessUsers: DemoBusinessUser[];
}

export const DEMO_BUSINESS_ID = 'demo-business';

let seq = 0;
function id(prefix: string): string {
  seq += 1;
  return `demo-${prefix}-${seq}`;
}

export function createDemoSeed(): DemoDb {
  seq = 0;
  const businessId = DEMO_BUSINESS_ID;
  const ownerId = 'demo-user-admin';

  const products: DemoProduct[] = [
    ['Coca Cola 500ml', 'Bebida gaseosa', '1200.00', '48', '7790895000016', null, false],
    ['Fideos Matarazzo 500g', 'Fideos secos', '850.00', '60', '7790070418014', daysFromNow(180), false],
    ['Queso Cremoso', 'Fraccionado por kilo', '6500.00', '8.500', '7791234567890', daysFromNow(10), true],
    ['Alfajor Triple', 'Chocolate', '900.00', '36', '7790040010017', null, false],
    ['Yerba Mate 1kg', null, '3200.00', '22', '7790742000013', null, false],
    ['Pan Lactal', null, '1900.00', '4', '7792222000111', daysFromNow(3), false],
    ['Leche Entera 1L', null, '1100.00', '3', '7791234000099', daysFromNow(5), false],
    ['Jamón Cocido', 'Fraccionado por kilo', '8900.00', '5.200', '7790000111222', daysFromNow(15), true],
    ['Detergente 750ml', null, '1500.00', '18', '7790001234567', null, false],
    ['Papel Higiénico x4', null, '2100.00', '27', '7790009988776', null, false],
    ['Agua Mineral 1.5L', null, '950.00', '40', '7790009911223', null, false],
    ['Galletitas Surtidas', null, '1350.00', '0', '7790004455667', null, false],
  ].map(([name, description, price, stock, barcode, expirationDate, soldByWeight]) => ({
    id: id('prod'),
    businessId,
    name: name as string,
    description: description as string | null,
    price: price as string,
    stock: stock as string,
    imageUrl: null,
    barcode: barcode as string,
    expirationDate: expirationDate as string | null,
    soldByWeight: soldByWeight as boolean,
    createdAt: daysFromNow(-30),
    updatedAt: daysFromNow(-1),
    deletedAt: null,
  }));

  const byName = (n: string) => products.find((p) => p.name === n)!;

  const combos: DemoCombo[] = [
    {
      id: id('combo'),
      businessId,
      name: 'Combo Merienda',
      description: 'Alfajor + Gaseosa a precio especial',
      price: '1900.00',
      imageUrl: null,
      barcode: null,
      isActive: true,
      createdAt: daysFromNow(-20),
      updatedAt: daysFromNow(-1),
      items: [
        { id: id('comboitem'), comboId: '', productId: byName('Alfajor Triple').id, quantity: '1' },
        { id: id('comboitem'), comboId: '', productId: byName('Coca Cola 500ml').id, quantity: '1' },
      ],
    },
    {
      id: id('combo'),
      businessId,
      name: '2 Fideos',
      description: 'Oferta por cantidad',
      price: '1500.00',
      imageUrl: null,
      barcode: null,
      isActive: true,
      createdAt: daysFromNow(-10),
      updatedAt: daysFromNow(-1),
      items: [
        { id: id('comboitem'), comboId: '', productId: byName('Fideos Matarazzo 500g').id, quantity: '2' },
      ],
    },
  ];
  combos.forEach((c) => c.items.forEach((it) => { it.comboId = c.id; }));

  const clients: DemoClient[] = [
    ['Juan Pérez', 'juan@example.com', '11-5555-1111', 'Av. Siempre Viva 123'],
    ['María García', 'maria@example.com', '11-5555-2222', null],
    ['Carlos Ruiz', null, '11-5555-3333', null],
    ['Sofía López', 'sofia@example.com', null, null],
  ].map(([name, email, phone, address]) => ({
    id: id('client'),
    businessId,
    name: name as string,
    email: email as string | null,
    phone: phone as string | null,
    address: address as string | null,
    createdAt: daysFromNow(-25),
    updatedAt: daysFromNow(-25),
  }));

  const suppliers: DemoSupplier[] = [
    ['Distribuidora Central', 'ventas@distcentral.com', '11-4444-0001', 'Parque Industrial 45'],
    ['Mayorista del Sur', null, '11-4444-0002', null],
  ].map(([name, email, phone, address]) => ({
    id: id('supplier'),
    businessId,
    name: name as string,
    email: email as string | null,
    phone: phone as string | null,
    address: address as string | null,
    createdAt: daysFromNow(-40),
    updatedAt: daysFromNow(-40),
  }));

  // A handful of historical sales so Reportes/Caja/Ventas/Dashboard don't look empty.
  const sales: DemoSale[] = [];
  const saleSeeds: Array<{ daysAgo: number; clientId: string | null; items: Array<{ product?: string; combo?: string; quantity: number; price: number }> }> = [
    { daysAgo: 6, clientId: clients[0].id, items: [{ product: 'Coca Cola 500ml', quantity: 2, price: 1200 }, { product: 'Alfajor Triple', quantity: 1, price: 900 }] },
    { daysAgo: 5, clientId: null, items: [{ product: 'Yerba Mate 1kg', quantity: 1, price: 3200 }] },
    { daysAgo: 4, clientId: clients[1].id, items: [{ combo: 'Combo Merienda', quantity: 2, price: 1900 }] },
    { daysAgo: 3, clientId: null, items: [{ product: 'Pan Lactal', quantity: 1, price: 1900 }, { product: 'Leche Entera 1L', quantity: 2, price: 1100 }] },
    { daysAgo: 2, clientId: clients[2].id, items: [{ product: 'Detergente 750ml', quantity: 1, price: 1500 }, { product: 'Papel Higiénico x4', quantity: 1, price: 2100 }] },
    { daysAgo: 1, clientId: null, items: [{ combo: '2 Fideos', quantity: 1, price: 1500 }] },
    { daysAgo: 0, clientId: clients[0].id, items: [{ product: 'Agua Mineral 1.5L', quantity: 3, price: 950 }] },
  ];
  for (const s of saleSeeds) {
    const items: DemoSaleItem[] = s.items.map((it) => ({
      id: id('saleitem'),
      saleId: '',
      productId: it.product ? byName(it.product).id : null,
      comboId: it.combo ? combos.find((c) => c.name === it.combo)!.id : null,
      quantity: String(it.quantity),
      price: it.price.toFixed(2),
    }));
    const total = s.items.reduce((sum, it) => sum + it.quantity * it.price, 0);
    const saleId = id('sale');
    items.forEach((it) => { it.saleId = saleId; });
    sales.push({
      id: saleId,
      businessId,
      clientId: s.clientId,
      total: total.toFixed(2),
      status: 'COMPLETED',
      createdAt: daysFromNow(-s.daysAgo),
      updatedAt: daysFromNow(-s.daysAgo),
      items,
    });
  }

  const purchases: DemoPurchase[] = [];
  {
    const items: DemoPurchaseItem[] = [
      { id: id('purchaseitem'), purchaseId: '', productId: byName('Yerba Mate 1kg').id, quantity: '10', price: '2100.00' },
      { id: id('purchaseitem'), purchaseId: '', productId: byName('Fideos Matarazzo 500g').id, quantity: '30', price: '520.00' },
    ];
    const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.price), 0);
    const purchaseId = id('purchase');
    items.forEach((it) => { it.purchaseId = purchaseId; });
    purchases.push({
      id: purchaseId,
      businessId,
      supplierId: suppliers[0].id,
      total: total.toFixed(2),
      createdAt: daysFromNow(-15),
      updatedAt: daysFromNow(-15),
      items,
    });
  }

  const transactions: DemoTransaction[] = [
    ...sales.map((s) => ({
      id: id('tx'),
      businessId,
      type: 'INCOME' as const,
      amount: s.total,
      description: `Venta #${s.id.slice(-8)}`,
      category: 'Ventas',
      date: s.createdAt,
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
    })),
    ...purchases.map((p) => ({
      id: id('tx'),
      businessId,
      type: 'EXPENSE' as const,
      amount: p.total,
      description: `Compra #${p.id.slice(-8)}`,
      category: 'Compras a Proveedores',
      date: p.createdAt,
      createdAt: p.createdAt,
      updatedAt: p.createdAt,
    })),
    {
      id: id('tx'),
      businessId,
      type: 'EXPENSE',
      amount: '45000.00',
      description: 'Alquiler del local',
      category: 'Alquiler',
      date: daysFromNow(-8),
      createdAt: daysFromNow(-8),
      updatedAt: daysFromNow(-8),
    },
    {
      id: id('tx'),
      businessId,
      type: 'EXPENSE',
      amount: '12000.00',
      description: 'Factura de luz',
      category: 'Servicios',
      date: daysFromNow(-7),
      createdAt: daysFromNow(-7),
      updatedAt: daysFromNow(-7),
    },
  ];

  const businessUsers: DemoBusinessUser[] = [
    {
      id: id('businessuser'),
      businessId,
      userId: ownerId,
      role: 'ADMIN',
      createdAt: daysFromNow(-30),
      user: { id: ownerId, email: 'demo@walti.app', username: 'demo', name: 'Admin Demo' },
    },
  ];

  return {
    business: {
      id: businessId,
      createdAt: daysFromNow(-30),
      updatedAt: daysFromNow(-1),
      deletedAt: null,
      name: 'Almacén Don Demo',
      slug: 'almacen-don-demo',
      logoUrl: null,
      isActive: true,
      planName: 'ENTERPRISE',
      planExpiresAt: null,
      ownerId,
    },
    businessSettings: {
      id: id('settings'),
      businessId,
      currency: 'ARS',
      taxRate: 21,
      shiftMorningStartHour: 8,
      shiftMorningEndHour: 12,
      shiftNightStartHour: 16,
      shiftNightEndHour: 21,
      shiftMorningLabel: 'Turno Mañana',
      shiftNightLabel: 'Turno Noche',
      ticketWidthMm: 58,
      printTicketOnSale: true,
    },
    storefront: {
      id: id('storefront'),
      businessId,
      heroTitle: 'Almacén Don Demo',
      heroSubtitle: 'Los mejores productos al mejor precio',
      heroImageUrl: null,
      primaryColor: '#3b82f6',
      themeMode: 'dark',
      logoUrl: null,
      aboutText: 'Este es un negocio de ejemplo para que pruebes Walti.',
      aboutImageUrl: null,
    },
    products,
    combos,
    clients,
    suppliers,
    sales,
    purchases,
    transactions,
    businessUsers,
  };
}

export function demoId(prefix: string): string {
  return id(prefix);
}
