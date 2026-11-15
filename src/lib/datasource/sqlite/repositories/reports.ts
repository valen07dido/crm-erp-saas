import { getDb } from '../connection';
import { Decimal } from '../decimal';
import type { AdvancedReports } from '../../types';

export const reportsRepository = {
  async getAdvanced(businessId: string): Promise<AdvancedReports> {
    const db = getDb();

    const itemRows = db
      .prepare(
        `SELECT si.product_id, si.quantity, si.price
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.business_id = ? AND s.status != 'CANCELLED' AND si.product_id IS NOT NULL`
      )
      .all(businessId) as { product_id: string; quantity: string; price: string }[];

    // Matches the original Postgres `groupBy` + `_sum` behavior exactly,
    // quirk included: revenue is (summed quantity) * (summed price), not a
    // per-line quantity*price sum — preserved as-is rather than "fixed"
    // during the port (see stats.ts's topProducts for the correct version
    // of this calculation, used by the dashboard instead of this report).
    const byProduct = new Map<string, { quantitySum: Decimal; priceSum: Decimal }>();
    for (const row of itemRows) {
      const existing = byProduct.get(row.product_id) || { quantitySum: new Decimal(0), priceSum: new Decimal(0) };
      existing.quantitySum = existing.quantitySum.plus(row.quantity);
      existing.priceSum = existing.priceSum.plus(row.price);
      byProduct.set(row.product_id, existing);
    }
    const rankedProducts = Array.from(byProduct.entries())
      .sort((a, b) => b[1].quantitySum.comparedTo(a[1].quantitySum))
      .slice(0, 5);

    const topProducts = rankedProducts.map(([productId, v]) => {
      const p = db.prepare('SELECT id, name FROM products WHERE id = ?').get(productId) as { id: string; name: string } | undefined;
      return {
        id: p?.id,
        name: p?.name || 'Desconocido',
        quantity: v.quantitySum.toNumber(),
        revenue: v.quantitySum.times(v.priceSum).toNumber(),
      };
    });

    const saleRows = db
      .prepare(
        `SELECT client_id, total FROM sales WHERE business_id = ? AND status != 'CANCELLED' AND client_id IS NOT NULL`
      )
      .all(businessId) as { client_id: string; total: string }[];

    const byClient = new Map<string, { totalSum: Decimal; count: number }>();
    for (const row of saleRows) {
      const existing = byClient.get(row.client_id) || { totalSum: new Decimal(0), count: 0 };
      existing.totalSum = existing.totalSum.plus(row.total);
      existing.count += 1;
      byClient.set(row.client_id, existing);
    }
    const rankedClients = Array.from(byClient.entries())
      .sort((a, b) => b[1].totalSum.comparedTo(a[1].totalSum))
      .slice(0, 5);

    const topClients = rankedClients.map(([clientId, v]) => {
      const c = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(clientId) as { id: string; name: string } | undefined;
      return { id: c?.id, name: c?.name || 'Desconocido', purchases: v.count, spent: v.totalSum.toNumber() };
    });

    return { topProducts, topClients };
  },
};
