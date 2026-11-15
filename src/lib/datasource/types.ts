// Shared contract between the two backends this app can run against:
// - prisma-datasource.ts: Postgres/Neon via Prisma (the SaaS web product, on Vercel).
// - sqlite-datasource.ts: a local SQLite file via better-sqlite3 (WALTI Desktop,
//   offline). See src/lib/datasource/index.ts for which one gets picked.
//
// Every route in src/pages/api/* should depend on THIS interface, never on
// `prisma` or `better-sqlite3` directly — that's what lets the same business
// logic (validation, stock math, transaction creation) run unchanged against
// either backend. Money/quantity fields are always plain decimal strings
// here (never number/Decimal) so a route's JSON response shape — and the
// frontend code that does `Number(product.stock)` on it — never changes
// depending on which datasource produced it.

export interface ProductRecord {
  id: string;
  name: string;
  description: string | null;
  price: string;
  stock: string;
  imageUrl: string | null;
  barcode: string | null;
  category: string | null;
  expirationDate: string | null;
  soldByWeight: boolean;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCreateInput {
  businessId: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  barcode?: string | null;
  category?: string | null;
  expirationDate?: string | null;
  soldByWeight: boolean;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string | null;
  price?: number;
  stock?: number;
  imageUrl?: string | null;
  barcode?: string | null;
  category?: string | null;
  expirationDate?: string | null;
  soldByWeight?: boolean;
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ComboItemInput {
  productId: string;
  quantity: number;
}

export interface ComboItemRecord {
  id: string;
  productId: string;
  quantity: number;
  product: { id: string; name: string };
}

export interface ComboRecord {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  barcode: string | null;
  isActive: boolean;
  businessId: string;
  createdAt: string;
  updatedAt: string;
  items: ComboItemRecord[];
}

export interface ComboCreateInput {
  businessId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  barcode?: string | null;
  isActive?: boolean;
  items: ComboItemInput[];
}

export interface ComboUpdateInput {
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  barcode?: string | null;
  isActive?: boolean;
  items?: ComboItemInput[];
}

export interface SupplierRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  /** Cost price for this purchase line; falls back to the product's current price if omitted. */
  price?: number;
}

export interface PurchaseItemRecord {
  id: string;
  purchaseId: string;
  productId: string;
  quantity: string;
  price: string;
  product: { id: string; name: string } | null;
}

export interface PurchaseRecord {
  id: string;
  businessId: string;
  supplierId: string | null;
  status: string;
  total: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseItemRecord[];
  supplier: SupplierRecord | null;
}

export interface PurchaseCreateInput {
  businessId: string;
  supplierId?: string | null;
  status?: string;
  items: PurchaseItemInput[];
}

export interface PurchaseImportLine {
  barcode?: string | null;
  name: string;
  quantity: number;
  cost: number;
  salePrice: number;
}

export interface PurchaseImportInput {
  businessId: string;
  supplierId?: string | null;
  items: PurchaseImportLine[];
}

export interface PurchaseImportResult {
  productsUpdated: number;
  purchase: PurchaseRecord | null;
}

export interface BusinessSettingsRecord {
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
}

export interface BusinessSettingsUpdateInput {
  currency?: string;
  taxRate?: number;
  shiftMorningStartHour?: number;
  shiftMorningEndHour?: number;
  shiftNightStartHour?: number;
  shiftNightEndHour?: number;
  shiftMorningLabel?: string;
  shiftNightLabel?: string;
  ticketWidthMm?: number;
  printTicketOnSale?: boolean;
}

export interface StatsSummary {
  salesToday: number;
  salesYesterday: number;
  salesMonth: number;
  salesLastMonth: number;
  productsInStock: number;
  totalClients: number;
  recentSales: { id: string; total: number; status: string; createdAt: string; clientName: string }[];
  lowStockProducts: { id: string; name: string; stock: number }[];
  salesSeries: { date: string; total: number }[];
  topProducts: { id: string; name: string; quantity: number; revenue: number }[];
  salesByCategory: { category: string; revenue: number }[];
  topClients: { id: string; name: string; total: number }[];
}

export interface AdvancedReports {
  topProducts: { id: string | undefined; name: string; quantity: number; revenue: number }[];
  topClients: { id: string | undefined; name: string; purchases: number; spent: number }[];
}

export interface BusinessUserRecord {
  id: string;
  userId: string;
  businessId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; username: string | null; name: string | null };
}

export interface BusinessUserCreateInput {
  businessId: string;
  name?: string | null;
  email: string;
  username: string;
  password: string;
  role: string;
}

export interface BusinessUserUpdateInput {
  role?: string;
  password?: string;
}

export interface SaleItemInput {
  productId?: string;
  comboId?: string;
  quantity: number;
}

export interface SaleItemRecord {
  id: string;
  saleId: string;
  productId: string | null;
  comboId: string | null;
  quantity: string;
  price: string;
  product: { id: string; name: string } | null;
  combo: { id: string; name: string } | null;
}

export interface SaleRecord {
  id: string;
  businessId: string;
  clientId: string | null;
  status: string;
  total: string;
  createdAt: string;
  updatedAt: string;
  items: SaleItemRecord[];
  client: ClientRecord | null;
}

export interface SaleCreateInput {
  businessId: string;
  clientId?: string | null;
  status?: string;
  items: SaleItemInput[];
}

export interface TransactionRecord {
  id: string;
  businessId: string;
  type: string;
  amount: string;
  description: string;
  category: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCreateInput {
  businessId: string;
  type: string;
  amount: number;
  description: string;
  category?: string | null;
  date?: string | null;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  passwordHash: string;
}

export interface BusinessMembership {
  userId: string;
  businessId: string;
  role: string;
}

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  isActive: boolean;
  planName: string | null;
  planExpiresAt: string | null;
}

export interface MembershipWithBusiness {
  business: BusinessSummary;
  role: string;
}

export interface DataSource {
  products: {
    list(businessId: string): Promise<ProductRecord[]>;
    findById(id: string): Promise<ProductRecord | null>;
    create(input: ProductCreateInput): Promise<ProductRecord>;
    update(id: string, input: ProductUpdateInput): Promise<ProductRecord>;
    delete(id: string): Promise<void>;
  };
  clients: {
    list(businessId: string): Promise<ClientRecord[]>;
    create(businessId: string, input: ClientInput): Promise<ClientRecord>;
    update(id: string, businessId: string, input: ClientInput): Promise<ClientRecord>;
    delete(id: string, businessId: string): Promise<void>;
  };
  suppliers: {
    list(businessId: string): Promise<SupplierRecord[]>;
    create(businessId: string, input: SupplierInput): Promise<SupplierRecord>;
    update(id: string, businessId: string, input: SupplierInput): Promise<SupplierRecord>;
    delete(id: string, businessId: string): Promise<void>;
  };
  purchases: {
    list(businessId: string): Promise<PurchaseRecord[]>;
    create(input: PurchaseCreateInput): Promise<PurchaseRecord>;
    bulkImport(input: PurchaseImportInput): Promise<PurchaseImportResult>;
  };
  combos: {
    list(businessId: string): Promise<ComboRecord[]>;
    findById(id: string): Promise<ComboRecord | null>;
    create(input: ComboCreateInput): Promise<ComboRecord>;
    update(id: string, businessId: string, input: ComboUpdateInput): Promise<ComboRecord>;
    delete(id: string, businessId: string): Promise<void>;
  };
  sales: {
    list(businessId: string): Promise<SaleRecord[]>;
    findById(id: string): Promise<SaleRecord | null>;
    create(input: SaleCreateInput): Promise<SaleRecord>;
    updateStatus(id: string, businessId: string, status: string): Promise<SaleRecord>;
  };
  transactions: {
    list(businessId: string, type?: string): Promise<TransactionRecord[]>;
    create(input: TransactionCreateInput): Promise<TransactionRecord>;
    delete(id: string, businessId: string): Promise<void>;
  };
  businessSettings: {
    get(businessId: string): Promise<BusinessSettingsRecord>;
    update(businessId: string, input: BusinessSettingsUpdateInput): Promise<BusinessSettingsRecord>;
  };
  stats: {
    get(businessId: string): Promise<StatsSummary>;
  };
  reports: {
    getAdvanced(businessId: string): Promise<AdvancedReports>;
  };
  businessUsers: {
    list(businessId: string): Promise<BusinessUserRecord[]>;
    findById(id: string): Promise<BusinessUserRecord | null>;
    /** Which field, if any, is already taken by another user — for the 409 conflict message. */
    findConflict(email: string, username: string): Promise<'email' | 'username' | null>;
    create(input: BusinessUserCreateInput): Promise<BusinessUserRecord>;
    update(id: string, businessId: string, input: BusinessUserUpdateInput): Promise<BusinessUserRecord>;
    delete(id: string, businessId: string): Promise<void>;
  };
  auth: {
    findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null>;
  };
  membership: {
    find(userId: string, businessId: string): Promise<BusinessMembership | null>;
    findForUser(userId: string): Promise<MembershipWithBusiness | null>;
  };
  setup: {
    /** Whether there isn't a single User yet — only meaningful in desktop mode. */
    needsInitialSetup(): Promise<boolean>;
    /** Creates the single seeded Business (if missing) plus its first ADMIN user. */
    createInitialAdmin(input: { businessName: string; email: string; username?: string | null; password: string }): Promise<{ businessId: string; userId: string }>;
  };
}
