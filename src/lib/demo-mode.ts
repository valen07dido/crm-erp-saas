// "Probar Walti" sandbox demo — a fully client-side simulation of the app.
//
// How it works: when demo mode is active, we monkey-patch window.fetch so
// that every call to this app's own /api/* (and /api/auth/*) routes is
// answered from an in-browser "database" kept in localStorage, instead of
// hitting the real network/Prisma backend. No dashboard page needed to
// change at all — they already just call fetch() and read the response.
//
// Nothing here ever touches a real business's data: demo mode is entirely
// contained to the visitor's own browser storage, and starting a fresh demo
// always wipes and reseeds it.
import { createDemoSeed, demoId, DemoDb, DemoProduct, DemoClient, DemoSupplier, DemoCombo, DemoSale, DemoPurchase, DemoTransaction, DemoBusinessUser } from './demo-data';

const FLAG_KEY = 'walti-demo-active';
const DB_KEY = 'walti-demo-db';
const BANNER_DISMISSED_KEY = 'walti-demo-banner-dismissed';
const FAR_FUTURE_ISO = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

// Next's middleware (src/middleware.ts) gates /dashboard on the server/edge,
// where localStorage doesn't exist — so demo mode also needs a real cookie
// the middleware can read, alongside the localStorage flag the client uses.
function setDemoCookie(active: boolean) {
  if (active) {
    document.cookie = `${FLAG_KEY}=true; path=/; max-age=${60 * 60 * 6}; SameSite=Lax`;
  } else {
    document.cookie = `${FLAG_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(FLAG_KEY) === 'true';
}

function loadDb(): DemoDb {
  const raw = typeof window !== 'undefined' ? localStorage.getItem(DB_KEY) : null;
  if (raw) {
    try {
      return JSON.parse(raw) as DemoDb;
    } catch {
      // fall through to reseed if corrupted
    }
  }
  const seed = createDemoSeed();
  saveDb(seed);
  return seed;
}

function saveDb(db: DemoDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/** Entry point for the "Probar Walti" button — always starts from a clean seed. */
export function startDemo() {
  saveDb(createDemoSeed());
  localStorage.setItem(FLAG_KEY, 'true');
  localStorage.removeItem(BANNER_DISMISSED_KEY);
  setDemoCookie(true);
  installDemoFetchInterceptor();
}

export function exitDemo() {
  localStorage.removeItem(FLAG_KEY);
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(BANNER_DISMISSED_KEY);
  setDemoCookie(false);
}

export function isDemoBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
}

export function dismissDemoBanner() {
  localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function empty(status = 204): Response {
  return new Response(null, { status });
}

function errorJson(message: string, status = 500): Response {
  return json({ error: message }, status);
}

function parseBody(init?: RequestInit): any {
  if (!init?.body) return {};
  try {
    return JSON.parse(init.body as string);
  } catch {
    return {};
  }
}

function hasBusinessIdHeader(init?: RequestInit): boolean {
  const h = init?.headers;
  if (!h) return false;
  if (h instanceof Headers) return !!h.get('x-business-id');
  const obj = h as Record<string, string>;
  return !!(obj['x-business-id'] || obj['X-Business-Id']);
}

function touch(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Hydration helpers — join normalized collections the way Prisma `include` would
// ---------------------------------------------------------------------------

function hydrateCombo(db: DemoDb, combo: DemoCombo) {
  return {
    ...combo,
    items: combo.items.map((it) => ({ ...it, product: db.products.find((p) => p.id === it.productId) || null })),
  };
}

function hydrateSale(db: DemoDb, sale: DemoSale) {
  return {
    ...sale,
    client: sale.clientId ? db.clients.find((c) => c.id === sale.clientId) || null : null,
    items: sale.items.map((it) => ({
      ...it,
      product: it.productId ? db.products.find((p) => p.id === it.productId) || null : null,
      combo: it.comboId ? db.combos.find((c) => c.id === it.comboId) || null : null,
    })),
  };
}

function hydratePurchase(db: DemoDb, purchase: DemoPurchase) {
  return {
    ...purchase,
    supplier: purchase.supplierId ? db.suppliers.find((s) => s.id === purchase.supplierId) || null : null,
    items: purchase.items.map((it) => ({ ...it, product: db.products.find((p) => p.id === it.productId) || null })),
  };
}

function comboAvailableUnits(db: DemoDb, combo: DemoCombo): number {
  if (combo.items.length === 0) return 0;
  return Math.min(
    ...combo.items.map((it) => {
      const product = db.products.find((p) => p.id === it.productId);
      if (!product) return 0;
      return Math.floor(Number(product.stock) / Number(it.quantity));
    })
  );
}

// ---------------------------------------------------------------------------
// The router: one big switch over pathname + method, mirroring the real API
// ---------------------------------------------------------------------------

async function handleRequest(pathname: string, search: URLSearchParams, method: string, init?: RequestInit): Promise<Response> {
  const db = loadDb();
  const body = parseBody(init);

  // --- NextAuth endpoints (so unmodified signOut()/useSession() just work) ---
  if (pathname === '/api/auth/session') {
    if (method !== 'GET') return json({});
    const admin = db.businessUsers[0];
    return json({
      user: { id: admin?.userId, name: admin?.user.name || 'Demo', email: admin?.user.email || 'demo@walti.app' },
      expires: FAR_FUTURE_ISO,
    });
  }
  if (pathname === '/api/auth/csrf') {
    return json({ csrfToken: 'demo-csrf-token' });
  }
  if (pathname === '/api/auth/signout') {
    exitDemo();
    return json({ url: '/auth/login' });
  }

  // --- /api/me ---
  if (pathname === '/api/me') {
    return json({ business: db.business, role: db.businessUsers[0]?.role || 'ADMIN' });
  }

  // --- /api/stats ---
  if (pathname === '/api/stats') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    const todayStr = new Date().toDateString();
    const monthStart = new Date();
    monthStart.setDate(1);
    const income = db.transactions.filter((t) => t.type === 'INCOME');
    const salesToday = income.filter((t) => new Date(t.date).toDateString() === todayStr).reduce((s, t) => s + Number(t.amount), 0);
    const salesMonth = income.filter((t) => new Date(t.date) >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
    // Matches the real /api/stats route: a COUNT of distinct products that
    // still have stock, not a sum of quantities (which would mix whole units
    // with fractional kg amounts from weighable products).
    const productsInStock = db.products.filter((p) => Number(p.stock) > 0).length;
    const recentSales = [...db.sales]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        total: Number(s.total),
        status: s.status,
        createdAt: s.createdAt,
        clientName: (s.clientId && db.clients.find((c) => c.id === s.clientId)?.name) || 'Consumidor Final',
      }));
    const lowStockProducts = db.products
      .filter((p) => Number(p.stock) <= 5)
      .sort((a, b) => Number(a.stock) - Number(b.stock))
      .slice(0, 10)
      .map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock) }));
    return json({ salesToday, salesMonth, productsInStock, totalClients: db.clients.length, recentSales, lowStockProducts });
  }

  // --- /api/reports/advanced ---
  if (pathname === '/api/reports/advanced') {
    if (method !== 'GET') return errorJson('Method not allowed', 405);
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    const qty: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const s of db.sales) {
      if (s.status === 'CANCELLED') continue;
      for (const it of s.items) {
        if (!it.productId) continue;
        const p = db.products.find((pp) => pp.id === it.productId);
        if (!p) continue;
        qty[p.id] = qty[p.id] || { name: p.name, quantity: 0, revenue: 0 };
        qty[p.id].quantity += Number(it.quantity);
        qty[p.id].revenue += Number(it.quantity) * Number(it.price);
      }
    }
    const topProducts = Object.entries(qty)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 5)
      .map(([id, v]) => ({ id, ...v }));

    const perClient: Record<string, { name: string; purchases: number; spent: number }> = {};
    for (const s of db.sales) {
      if (s.status === 'CANCELLED' || !s.clientId) continue;
      const c = db.clients.find((cc) => cc.id === s.clientId);
      if (!c) continue;
      perClient[c.id] = perClient[c.id] || { name: c.name, purchases: 0, spent: 0 };
      perClient[c.id].purchases += 1;
      perClient[c.id].spent += Number(s.total);
    }
    const topClients = Object.entries(perClient)
      .sort((a, b) => b[1].spent - a[1].spent)
      .slice(0, 5)
      .map(([id, v]) => ({ id, ...v }));

    return json({ topProducts, topClients });
  }

  // --- /api/products ---
  if (pathname === '/api/products') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method === 'GET') {
      return json([...db.products].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
    }
    if (method === 'POST') {
      if (!body.name) return errorJson('El nombre del producto es obligatorio', 400);
      const product: DemoProduct = {
        id: demoId('prod'),
        businessId: db.business.id,
        name: body.name,
        description: body.description ?? null,
        price: String(body.price ?? 0),
        stock: String(body.stock ?? 0),
        imageUrl: body.imageUrl ?? null,
        barcode: body.barcode ?? null,
        expirationDate: body.expirationDate ?? null,
        soldByWeight: !!body.soldByWeight,
        createdAt: touch(),
        updatedAt: touch(),
        deletedAt: null,
      };
      db.products.unshift(product);
      saveDb(db);
      return json(product, 201);
    }
    if (method === 'PUT') {
      const pid = search.get('id');
      if (!pid) return errorJson('Product id is required in query', 400);
      const idx = db.products.findIndex((p) => p.id === pid);
      if (idx === -1) return errorJson('Product not found', 404);
      db.products[idx] = { ...db.products[idx], ...body, price: String(body.price ?? db.products[idx].price), stock: String(body.stock ?? db.products[idx].stock), updatedAt: touch() };
      saveDb(db);
      return json(db.products[idx]);
    }
    if (method === 'DELETE') {
      const pid = search.get('id');
      db.products = db.products.filter((p) => p.id !== pid);
      saveDb(db);
      return empty(204);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/import/products ---
  if (pathname === '/api/import/products') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method !== 'POST') return errorJson('Method not allowed', 405);
    const rows: any[] = Array.isArray(body.products) ? body.products : [];
    if (rows.length === 0) return errorJson('No products provided', 400);
    for (const r of rows) {
      db.products.unshift({
        id: demoId('prod'),
        businessId: db.business.id,
        name: r.name || 'Producto sin nombre',
        description: r.description ?? null,
        price: String(r.price ?? 0),
        stock: String(r.stock ?? 0),
        imageUrl: r.imageUrl ?? null,
        barcode: r.barcode ?? null,
        expirationDate: null,
        soldByWeight: false,
        createdAt: touch(),
        updatedAt: touch(),
        deletedAt: null,
      });
    }
    saveDb(db);
    return json({ success: true, count: rows.length }, 201);
  }

  // --- /api/combos ---
  if (pathname === '/api/combos') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method === 'GET') {
      return json([...db.combos].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((c) => hydrateCombo(db, c)));
    }
    const sumQty = (items: any[]) => (Array.isArray(items) ? items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0);
    if (method === 'POST') {
      if (!body.name) return errorJson('El nombre del combo es obligatorio', 400);
      if (sumQty(body.items) < 2) return errorJson('Un combo necesita al menos 2 unidades en total', 400);
      const comboId = demoId('combo');
      const combo: DemoCombo = {
        id: comboId,
        businessId: db.business.id,
        name: body.name,
        description: body.description ?? null,
        price: String(body.price ?? 0),
        imageUrl: body.imageUrl ?? null,
        barcode: body.barcode ?? null,
        isActive: body.isActive ?? true,
        createdAt: touch(),
        updatedAt: touch(),
        items: body.items.map((it: any) => ({ id: demoId('comboitem'), comboId, productId: it.productId, quantity: String(it.quantity) })),
      };
      db.combos.unshift(combo);
      saveDb(db);
      return json(hydrateCombo(db, combo), 201);
    }
    if (method === 'PUT') {
      const cid = search.get('id');
      if (!cid) return errorJson('Combo id is required in query', 400);
      if (body.items && sumQty(body.items) < 2) return errorJson('Un combo necesita al menos 2 unidades en total', 400);
      const idx = db.combos.findIndex((c) => c.id === cid);
      if (idx === -1) return errorJson('Combo not found', 404);
      const existing = db.combos[idx];
      db.combos[idx] = {
        ...existing,
        ...body,
        price: String(body.price ?? existing.price),
        updatedAt: touch(),
        items: body.items ? body.items.map((it: any) => ({ id: demoId('comboitem'), comboId: cid, productId: it.productId, quantity: String(it.quantity) })) : existing.items,
      };
      saveDb(db);
      return json(hydrateCombo(db, db.combos[idx]));
    }
    if (method === 'DELETE') {
      const cid = search.get('id');
      db.combos = db.combos.filter((c) => c.id !== cid);
      saveDb(db);
      return empty(204);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/clients ---
  if (pathname === '/api/clients') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing business ID', 401);
    if (method === 'GET') return json(db.clients);
    if (method === 'POST') {
      const client: DemoClient = {
        id: demoId('client'),
        businessId: db.business.id,
        name: body.name || 'Cliente sin nombre',
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        createdAt: touch(),
        updatedAt: touch(),
      };
      db.clients.unshift(client);
      saveDb(db);
      return json(client, 201);
    }
    if (method === 'PUT') {
      const cid = search.get('id');
      const idx = db.clients.findIndex((c) => c.id === cid);
      if (idx === -1) return errorJson('Error updating client', 500);
      db.clients[idx] = { ...db.clients[idx], ...body, updatedAt: touch() };
      saveDb(db);
      return json(db.clients[idx]);
    }
    if (method === 'DELETE') {
      const cid = search.get('id');
      db.clients = db.clients.filter((c) => c.id !== cid);
      saveDb(db);
      return empty(204);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/import/clients ---
  if (pathname === '/api/import/clients') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method !== 'POST') return errorJson('Method not allowed', 405);
    const rows: any[] = Array.isArray(body.clients) ? body.clients : [];
    if (rows.length === 0) return errorJson('No clients provided', 400);
    for (const r of rows) {
      db.clients.unshift({
        id: demoId('client'),
        businessId: db.business.id,
        name: r.name || 'Cliente sin nombre',
        email: r.email ?? null,
        phone: r.phone ?? null,
        address: r.address ?? null,
        createdAt: touch(),
        updatedAt: touch(),
      });
    }
    saveDb(db);
    return json({ success: true, count: rows.length }, 201);
  }

  // --- /api/suppliers ---
  if (pathname === '/api/suppliers') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing business ID', 401);
    if (method === 'GET') return json(db.suppliers);
    if (method === 'POST') {
      const supplier: DemoSupplier = {
        id: demoId('supplier'),
        businessId: db.business.id,
        name: body.name || 'Proveedor sin nombre',
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        createdAt: touch(),
        updatedAt: touch(),
      };
      db.suppliers.unshift(supplier);
      saveDb(db);
      return json(supplier, 201);
    }
    if (method === 'PUT') {
      const sid = search.get('id');
      const idx = db.suppliers.findIndex((s) => s.id === sid);
      if (idx === -1) return errorJson('Error updating supplier', 500);
      db.suppliers[idx] = { ...db.suppliers[idx], ...body, updatedAt: touch() };
      saveDb(db);
      return json(db.suppliers[idx]);
    }
    if (method === 'DELETE') {
      const sid = search.get('id');
      db.suppliers = db.suppliers.filter((s) => s.id !== sid);
      saveDb(db);
      return empty(204);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/sales ---
  if (pathname === '/api/sales') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing business ID', 401);
    if (method === 'GET') {
      return json([...db.sales].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((s) => hydrateSale(db, s)));
    }
    if (method === 'POST') {
      const items: Array<{ productId?: string; comboId?: string; quantity: number }> = body.items || [];
      let total = 0;
      const saleItems: typeof db.sales[0]['items'] = [];
      const saleId = demoId('sale');
      for (const it of items) {
        if (it.comboId) {
          const combo = db.combos.find((c) => c.id === it.comboId);
          if (!combo) return errorJson(`Combo not found: ${it.comboId}`, 400);
          for (const ci of combo.items) {
            const product = db.products.find((p) => p.id === ci.productId);
            if (!product) return errorJson(`Product not found: ${ci.productId}`, 400);
            const needed = Number(ci.quantity) * it.quantity;
            if (Number(product.stock) < needed) return errorJson(`Stock insuficiente de ${product.name} para el combo ${combo.name}`, 400);
          }
          for (const ci of combo.items) {
            const product = db.products.find((p) => p.id === ci.productId)!;
            product.stock = String(Number(product.stock) - Number(ci.quantity) * it.quantity);
          }
          const price = Number(combo.price);
          total += price * it.quantity;
          saleItems.push({ id: demoId('saleitem'), saleId, productId: null, comboId: combo.id, quantity: String(it.quantity), price: price.toFixed(2) });
        } else if (it.productId) {
          const product = db.products.find((p) => p.id === it.productId);
          if (!product) return errorJson(`Product not found: ${it.productId}`, 400);
          if (Number(product.stock) < it.quantity) return errorJson(`Insufficient stock for ${product.name}`, 400);
          product.stock = String(Number(product.stock) - it.quantity);
          const price = Number(product.price);
          total += price * it.quantity;
          saleItems.push({ id: demoId('saleitem'), saleId, productId: product.id, comboId: null, quantity: String(it.quantity), price: price.toFixed(2) });
        }
      }
      const sale: DemoSale = {
        id: saleId,
        businessId: db.business.id,
        clientId: body.clientId || null,
        total: total.toFixed(2),
        status: body.status || 'COMPLETED',
        createdAt: touch(),
        updatedAt: touch(),
        items: saleItems,
      };
      db.sales.unshift(sale);
      db.transactions.unshift({
        id: demoId('tx'),
        businessId: db.business.id,
        type: 'INCOME',
        amount: sale.total,
        description: `Venta #${sale.id.slice(-8)}`,
        category: 'Ventas',
        date: sale.createdAt,
        createdAt: sale.createdAt,
        updatedAt: sale.createdAt,
      });
      saveDb(db);
      return json(hydrateSale(db, sale), 201);
    }
    if (method === 'PUT') {
      if (!body.id || !body.status) return errorJson('Missing fields', 400);
      const sale = db.sales.find((s) => s.id === body.id);
      if (!sale) return errorJson('Sale not found', 404);
      if (sale.status === body.status) return json(hydrateSale(db, sale));
      if (body.status === 'CANCELLED') {
        for (const it of sale.items) {
          if (it.productId) {
            const p = db.products.find((pp) => pp.id === it.productId);
            if (p) p.stock = String(Number(p.stock) + Number(it.quantity));
          } else if (it.comboId) {
            const combo = db.combos.find((c) => c.id === it.comboId);
            if (combo) {
              for (const ci of combo.items) {
                const p = db.products.find((pp) => pp.id === ci.productId);
                if (p) p.stock = String(Number(p.stock) + Number(ci.quantity) * Number(it.quantity));
              }
            }
          }
        }
      }
      sale.status = body.status;
      sale.updatedAt = touch();
      saveDb(db);
      return json(hydrateSale(db, sale));
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/purchases/parse-invoice & /api/purchases/import (handled before /api/purchases below since both start with that prefix) ---
  if (pathname === '/api/purchases/parse-invoice') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method !== 'POST') return errorJson('Method not allowed', 405);
    // Demo mode doesn't actually parse a PDF — return a small canned preview so
    // the "Importar Factura PDF" screen has something to show and confirm.
    return json({
      rawText: '(Vista previa simulada en el modo demo)',
      items: [
        { name: 'Producto de ejemplo (factura)', code: '7790000000001', quantity: 10, cost: 500 },
      ],
    });
  }
  if (pathname === '/api/purchases/import') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method !== 'POST') return errorJson('Method not allowed', 405);
    const rows: any[] = Array.isArray(body.items) ? body.items : [];
    if (rows.length === 0) return errorJson('No hay productos para importar', 400);
    const purchaseId = demoId('purchase');
    const items: DemoPurchase['items'] = [];
    let total = 0;
    let productsUpdated = 0;
    for (const r of rows) {
      if (!(r.quantity > 0)) continue;
      let product = db.products.find((p) => (r.barcode && p.barcode === r.barcode) || p.name.toLowerCase() === String(r.name).toLowerCase());
      if (!product) {
        product = {
          id: demoId('prod'), businessId: db.business.id, name: r.name || 'Producto', description: null,
          price: String(r.salePrice ?? r.cost ?? 0), stock: '0', imageUrl: null, barcode: r.barcode ?? null,
          expirationDate: null, soldByWeight: false, createdAt: touch(), updatedAt: touch(), deletedAt: null,
        };
        db.products.unshift(product);
      }
      product.stock = String(Number(product.stock) + Number(r.quantity));
      if (r.salePrice) product.price = String(r.salePrice);
      product.updatedAt = touch();
      productsUpdated += 1;
      const price = Number(r.cost ?? 0);
      total += price * Number(r.quantity);
      items.push({ id: demoId('purchaseitem'), purchaseId, productId: product.id, quantity: String(r.quantity), price: price.toFixed(2) });
    }
    let purchase: DemoPurchase | null = null;
    if (items.length > 0) {
      purchase = { id: purchaseId, businessId: db.business.id, supplierId: body.supplierId || null, total: total.toFixed(2), createdAt: touch(), updatedAt: touch(), items };
      db.purchases.unshift(purchase);
      db.transactions.unshift({
        id: demoId('tx'), businessId: db.business.id, type: 'EXPENSE', amount: purchase.total,
        description: `Compra #${purchase.id.slice(-8)} (Factura PDF)`, category: 'Compras a Proveedores',
        date: purchase.createdAt, createdAt: purchase.createdAt, updatedAt: purchase.createdAt,
      });
    }
    saveDb(db);
    return json({ productsUpdated, purchase: purchase ? hydratePurchase(db, purchase) : null }, 201);
  }

  // --- /api/purchases ---
  if (pathname === '/api/purchases') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing business ID', 401);
    if (method === 'GET') {
      return json([...db.purchases].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((p) => hydratePurchase(db, p)));
    }
    if (method === 'POST') {
      const items: Array<{ productId: string; quantity: number; price?: number }> = body.items || [];
      const purchaseId = demoId('purchase');
      let total = 0;
      const purchaseItems: DemoPurchase['items'] = [];
      for (const it of items) {
        const product = db.products.find((p) => p.id === it.productId);
        if (!product) return errorJson(`Product not found: ${it.productId}`, 400);
        const price = it.price ?? Number(product.price);
        product.stock = String(Number(product.stock) + it.quantity);
        product.updatedAt = touch();
        total += price * it.quantity;
        purchaseItems.push({ id: demoId('purchaseitem'), purchaseId, productId: product.id, quantity: String(it.quantity), price: String(price) });
      }
      const purchase: DemoPurchase = { id: purchaseId, businessId: db.business.id, supplierId: body.supplierId || null, total: total.toFixed(2), createdAt: touch(), updatedAt: touch(), items: purchaseItems };
      db.purchases.unshift(purchase);
      db.transactions.unshift({
        id: demoId('tx'), businessId: db.business.id, type: 'EXPENSE', amount: purchase.total,
        description: `Compra #${purchase.id.slice(-8)}`, category: 'Compras a Proveedores',
        date: purchase.createdAt, createdAt: purchase.createdAt, updatedAt: purchase.createdAt,
      });
      saveDb(db);
      return json(hydratePurchase(db, purchase), 201);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/transactions ---
  if (pathname === '/api/transactions') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing business ID', 401);
    if (method === 'GET') {
      const type = search.get('type');
      let rows = [...db.transactions];
      if (type) rows = rows.filter((t) => t.type === type);
      rows.sort((a, b) => +new Date(b.date) - +new Date(a.date));
      return json(rows);
    }
    if (method === 'POST') {
      const tx: DemoTransaction = {
        id: demoId('tx'),
        businessId: db.business.id,
        type: body.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
        amount: String(parseFloat(body.amount) || 0),
        description: body.description ?? null,
        category: body.category ?? null,
        date: body.date || touch(),
        createdAt: touch(),
        updatedAt: touch(),
      };
      db.transactions.unshift(tx);
      saveDb(db);
      return json(tx, 201);
    }
    if (method === 'DELETE') {
      const tid = search.get('id');
      db.transactions = db.transactions.filter((t) => t.id !== tid);
      saveDb(db);
      return empty(204);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/business-settings ---
  if (pathname === '/api/business-settings') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method === 'GET') return json(db.businessSettings);
    if (method === 'PUT') {
      const clampHour = (h: number) => Math.min(23, Math.max(0, h));
      const s = db.businessSettings;
      if (body.currency !== undefined) s.currency = body.currency;
      if (body.taxRate !== undefined) s.taxRate = body.taxRate;
      if (body.shiftMorningStartHour !== undefined) s.shiftMorningStartHour = clampHour(body.shiftMorningStartHour);
      if (body.shiftMorningEndHour !== undefined) s.shiftMorningEndHour = clampHour(body.shiftMorningEndHour);
      if (body.shiftNightStartHour !== undefined) s.shiftNightStartHour = clampHour(body.shiftNightStartHour);
      if (body.shiftNightEndHour !== undefined) s.shiftNightEndHour = clampHour(body.shiftNightEndHour);
      if (body.shiftMorningLabel !== undefined) s.shiftMorningLabel = body.shiftMorningLabel;
      if (body.shiftNightLabel !== undefined) s.shiftNightLabel = body.shiftNightLabel;
      if (body.ticketWidthMm !== undefined) s.ticketWidthMm = Math.min(300, Math.max(30, body.ticketWidthMm));
      if (body.printTicketOnSale !== undefined) s.printTicketOnSale = body.printTicketOnSale;
      saveDb(db);
      return json(s);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/storefront-settings (used by Sidebar + Settings page) ---
  if (pathname === '/api/storefront-settings') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method === 'GET') return json(db.storefront);
    if (method === 'PUT') {
      const sf = db.storefront;
      for (const k of ['heroTitle', 'heroSubtitle', 'heroImageUrl', 'primaryColor', 'themeMode', 'logoUrl', 'aboutText', 'aboutImageUrl'] as const) {
        if (body[k] !== undefined) (sf as any)[k] = body[k];
      }
      saveDb(db);
      return json(sf);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/storefront (used by the Tienda Online preview page) ---
  if (pathname === '/api/storefront') {
    if (!hasBusinessIdHeader(init)) return errorJson('Falta ID de negocio', 401);
    if (method === 'GET') return json(db.storefront);
    if (method === 'PUT') {
      const sf = db.storefront;
      for (const k of ['heroTitle', 'heroSubtitle', 'heroImageUrl', 'primaryColor', 'themeMode'] as const) {
        if (body[k] !== undefined) (sf as any)[k] = body[k];
      }
      saveDb(db);
      return json(sf);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- /api/business-users ---
  if (pathname === '/api/business-users') {
    if (!hasBusinessIdHeader(init)) return errorJson('Missing x-business-id header', 400);
    if (method === 'GET') return json([...db.businessUsers].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
    if (method === 'POST') {
      const email = (body.email || '').trim().toLowerCase();
      const username = (body.username || '').trim().toLowerCase();
      if (!email || !username || !body.password) return errorJson('Email, usuario y contraseña son obligatorios', 400);
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return errorJson('El usuario debe tener entre 3 y 32 caracteres (letras, números, _ . -)', 400);
      if (body.password.length < 4) return errorJson('La contraseña es muy corta', 400);
      if (db.businessUsers.some((bu) => bu.user.email === email)) return errorJson('El email ya está registrado', 409);
      if (db.businessUsers.some((bu) => bu.user.username === username)) return errorJson('El usuario ya está en uso', 409);
      const userId = demoId('user');
      const bu: DemoBusinessUser = {
        id: demoId('businessuser'), businessId: db.business.id, userId, role: body.role === 'POS' ? 'POS' : 'ADMIN',
        createdAt: touch(), user: { id: userId, email, username, name: body.name || null },
      };
      db.businessUsers.push(bu);
      saveDb(db);
      return json(bu, 201);
    }
    if (method === 'PUT') {
      if (!body.id) return errorJson('Datos inválidos', 400);
      if (body.role !== undefined && body.role !== 'ADMIN' && body.role !== 'POS') return errorJson('Rol inválido', 400);
      if (body.password !== undefined && body.password.length < 4) return errorJson('La contraseña es muy corta', 400);
      const bu = db.businessUsers.find((u) => u.id === body.id);
      if (!bu) return errorJson('Usuario no encontrado en este negocio', 404);
      if (body.role !== undefined) bu.role = body.role;
      saveDb(db);
      return json(bu);
    }
    if (method === 'DELETE') {
      const uid = search.get('id');
      if (!uid) return errorJson('Missing id', 400);
      const bu = db.businessUsers.find((u) => u.id === uid);
      if (!bu) return errorJson('Usuario no encontrado en este negocio', 404);
      if (bu.userId === db.business.ownerId) return errorJson('No podés eliminarte a vos mismo', 400);
      db.businessUsers = db.businessUsers.filter((u) => u.id !== uid);
      saveDb(db);
      return empty(204);
    }
    return errorJson('Method not allowed', 405);
  }

  // --- Cloudinary signature (image uploads) — demo mode never actually uploads ---
  if (pathname === '/api/cloudinary/signature') {
    return errorJson('La carga de imágenes no está disponible en el modo demo', 400);
  }

  // Unknown app API route under demo mode: fail closed rather than silently
  // hitting the real backend with fake headers.
  if (pathname.startsWith('/api/')) {
    return errorJson(`(demo) Ruta no simulada: ${pathname}`, 404);
  }

  // Not one of ours — let the caller fall back to the real network.
  return json({ __demo_passthrough: true }, 599);
}

// ---------------------------------------------------------------------------
// fetch() monkey-patch
// ---------------------------------------------------------------------------

let installed = false;
let realFetch: typeof window.fetch | null = null;

export function installDemoFetchInterceptor() {
  if (typeof window === 'undefined' || installed) return;
  installed = true;
  realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const isAppApiCall = urlStr.startsWith('/api/') || (urlStr.includes('://') && new URL(urlStr).pathname.startsWith('/api/') && new URL(urlStr).origin === window.location.origin);

    if (!isDemoMode() || !isAppApiCall) {
      return realFetch!(input, init);
    }

    const url = new URL(urlStr, window.location.origin);
    const method = (init?.method || 'GET').toUpperCase();
    const res = await handleRequest(url.pathname, url.searchParams, method, init);
    if (res.status === 599) {
      return realFetch!(input, init);
    }
    return res;
  };
}
