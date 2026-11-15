import { runMigrations } from './sqlite/migrate';
import { productsRepository } from './sqlite/repositories/products';
import { clientsRepository } from './sqlite/repositories/clients';
import { suppliersRepository } from './sqlite/repositories/suppliers';
import { purchasesRepository } from './sqlite/repositories/purchases';
import { combosRepository } from './sqlite/repositories/combos';
import { salesRepository } from './sqlite/repositories/sales';
import { transactionsRepository } from './sqlite/repositories/transactions';
import { authRepository, membershipRepository } from './sqlite/repositories/auth';
import { businessUsersRepository } from './sqlite/repositories/business-users';
import { setupRepository } from './sqlite/repositories/setup';
import { businessSettingsRepository } from './sqlite/repositories/business-settings';
import { statsRepository } from './sqlite/repositories/stats';
import { reportsRepository } from './sqlite/repositories/reports';
import type { DataSource } from './types';

// Runs once, the first time this module is imported (i.e. the first call to
// getDataSource() in desktop mode) — safe to run on every app start, it's a
// no-op once every migration is already applied.
runMigrations();

export const sqliteDataSource: DataSource = {
  products: productsRepository,
  clients: clientsRepository,
  suppliers: suppliersRepository,
  purchases: purchasesRepository,
  combos: combosRepository,
  sales: salesRepository,
  transactions: transactionsRepository,
  auth: authRepository,
  membership: membershipRepository,
  businessUsers: businessUsersRepository,
  setup: setupRepository,
  businessSettings: businessSettingsRepository,
  stats: statsRepository,
  reports: reportsRepository,
};
