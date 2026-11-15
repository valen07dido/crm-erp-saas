import { getDb } from '../connection';
import { Decimal } from '../decimal';
import type { StatsSummary } from '../../types';

interface ProductRow {
  id: string;
  name: string;
  stock: string;
}

interface SaleRow {
  id: string;
  total: string;
  status: string;
  created_at: string;
  client_name: string | null;
}

function sumSalesBetween(businessId: string, fromIso: string, toIso?: string): number {
  const db = getDb();
  const rows = (
    toIso
      ? db
          .prepare(`SELECT total FROM sales WHERE business_id = ? AND status != 'CANCELLED' AND created_at >= ? AND created_at < ?`)
          .all(businessId, fromIso, toIso)
      : db.prepare(`SELECT total FROM sales WHERE business_id = ? AND status != 'CANCELLED' AND created_at >= ?`).all(businessId, fromIso)
  ) as { total: string }[];
  return rows.reduce((sum, r) => sum + Number(r.total), 0);
}

export const statsRepository = {
  async get(businessId: string): Promise<StatsSummary> {
    const db = getDb();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const SERIES_DAYS = 14;
    const seriesStart = new Date(today);
    seriesStart.setDate(seriesStart.getDate() - (SERIES_DAYS - 1));

    const todayIso = today.toISOString();
    const yesterdayIso = yesterday.toISOString();
    const firstDayIso = firstDayOfMonth.toISOString();
    const firstDayLastIso = firstDayOfLastMonth.toISOString();
    const seriesStartIso = seriesStart.toISOString();

    const salesToday = sumSalesBetween(businessId, todayIso);
    const salesYesterday = sumSalesBetween(businessId, yesterdayIso, todayIso);
    const salesMonth = sumSalesBetween(businessId, firstDayIso);
    const salesLastMonth = sumSalesBetween(businessId, firstDayLastIso, firstDayIso);

    const allProducts = db.prepare('SELECT * FROM products WHERE business_id = ?').all(businessId) as ProductRow[];
    const productsInStock = allProducts.filter((p) => new Decimal(p.stock).greaterThan(0)).length;
    const lowStockProducts = allProducts
      .filter((p) => new Decimal(p.stock).lessThanOrEqualTo(5))
      .sort((a, b) => new Decimal(a.stock).comparedTo(new Decimal(b.stock)))
      .slice(0, 10)
      .map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock) }));

    const totalClients = (db.prepare('SELECT COUNT(*) as c FROM clients WHERE business_id = ?').get(businessId) as { c: number }).c;

    const recentSaleRows = db
      .prepare(
        `SELECT s.id, s.total, s.status, s.created_at, c.name as client_name
         FROM sales s LEFT JOIN clients c ON c.id = s.client_id
         WHERE s.business_id = ? ORDER BY s.created_at DESC LIMIT 5`
      )
      .all(businessId) as SaleRow[];
    const recentSales = recentSaleRows.map((r) => ({
      id: r.id,
      total: Number(r.total),
      status: r.status,
      createdAt: r.created_at,
      clientName: r.client_name || 'Consumidor Final',
    }));

    const seriesRows = db
      .prepare(`SELECT total, created_at FROM sales WHERE business_id = ? AND status != 'CANCELLED' AND created_at >= ?`)
      .all(businessId, seriesStartIso) as { total: string; created_at: string }[];
    const seriesMap = new Map<string, number>();
    for (let i = 0; i < SERIES_DAYS; i++) {
      const d = new Date(seriesStart);
      d.setDate(d.getDate() + i);
      seriesMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of seriesRows) {
      const key = row.created_at.slice(0, 10);
      seriesMap.set(key, (seriesMap.get(key) ?? 0) + Number(row.total));
    }
    const salesSeries = Array.from(seriesMap, ([date, total]) => ({ date, total }));

    const monthItemRows = db
      .prepare(
        `SELECT si.quantity, si.price, p.id as product_id, p.name as product_name, p.category as product_category
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         WHERE s.business_id = ? AND s.status != 'CANCELLED' AND s.created_at >= ? AND si.product_id IS NOT NULL`
      )
      .all(businessId, firstDayIso) as { quantity: string; price: string; product_id: string; product_name: string; product_category: string | null }[];

    const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
    const categoryTotals = new Map<string, number>();
    for (const item of monthItemRows) {
      const revenue = Number(item.price) * Number(item.quantity);
      const existing = productTotals.get(item.product_id);
      if (existing) {
        existing.quantity += Number(item.quantity);
        existing.revenue += revenue;
      } else {
        productTotals.set(item.product_id, { name: item.product_name, quantity: Number(item.quantity), revenue });
      }
      const cat = item.product_category || 'Sin categoría';
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + revenue);
    }
    const topProducts = Array.from(productTotals, ([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const salesByCategory = Array.from(categoryTotals, ([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const monthClientRows = db
      .prepare(
        `SELECT s.total, c.id as client_id, c.name as client_name
         FROM sales s JOIN clients c ON c.id = s.client_id
         WHERE s.business_id = ? AND s.status != 'CANCELLED' AND s.created_at >= ? AND s.client_id IS NOT NULL`
      )
      .all(businessId, firstDayIso) as { total: string; client_id: string; client_name: string }[];
    const clientTotals = new Map<string, { name: string; total: number }>();
    for (const row of monthClientRows) {
      const existing = clientTotals.get(row.client_id);
      if (existing) {
        existing.total += Number(row.total);
      } else {
        clientTotals.set(row.client_id, { name: row.client_name, total: Number(row.total) });
      }
    }
    const topClients = Array.from(clientTotals, ([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      salesToday,
      salesYesterday,
      salesMonth,
      salesLastMonth,
      productsInStock,
      totalClients,
      recentSales,
      lowStockProducts,
      salesSeries,
      topProducts,
      salesByCategory,
      topClients,
    };
  },
};
