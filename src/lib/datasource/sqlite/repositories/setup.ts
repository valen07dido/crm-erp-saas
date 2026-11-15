import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../connection';

export const setupRepository = {
  async needsInitialSetup(): Promise<boolean> {
    const row = getDb().prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return row.count === 0;
  },

  async createInitialAdmin(input: {
    businessName: string;
    email: string;
    username?: string | null;
    password: string;
  }): Promise<{ businessId: string; userId: string }> {
    const db = getDb();
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (existingUsers.count > 0) throw new Error('Ya existe un administrador configurado');

    const now = new Date().toISOString();
    const existingBusiness = db.prepare('SELECT id FROM businesses LIMIT 1').get() as { id: string } | undefined;
    const businessId = existingBusiness?.id ?? randomUUID();

    const run = db.transaction(() => {
      if (!existingBusiness) {
        db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
          businessId,
          input.businessName,
          now,
          now
        );
      }
      const userId = randomUUID();
      const passwordHash = bcrypt.hashSync(input.password, 10);
      db.prepare(
        'INSERT INTO users (id, email, username, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, input.email.toLowerCase(), input.username ? input.username.toLowerCase() : null, passwordHash, input.businessName, now, now);
      db.prepare(
        'INSERT INTO business_users (id, user_id, business_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), userId, businessId, 'ADMIN', now, now);
      return userId;
    });

    const userId = run();
    return { businessId, userId };
  },
};
