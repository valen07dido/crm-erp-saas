import { getDb } from '../connection';
import type { AuthUserRecord, BusinessMembership, MembershipWithBusiness } from '../../types';

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  password_hash: string;
}

interface BusinessUserRow {
  user_id: string;
  business_id: string;
  role: string;
}

interface BusinessRow {
  id: string;
  name: string;
}

export const authRepository = {
  async findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null> {
    const row = getDb()
      .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
      .get(identifier, identifier) as UserRow | undefined;
    if (!row) return null;
    return { id: row.id, email: row.email, username: row.username, name: row.name, passwordHash: row.password_hash };
  },
};

export const membershipRepository = {
  async find(userId: string, businessId: string): Promise<BusinessMembership | null> {
    const row = getDb()
      .prepare('SELECT * FROM business_users WHERE user_id = ? AND business_id = ?')
      .get(userId, businessId) as BusinessUserRow | undefined;
    return row ? { userId: row.user_id, businessId: row.business_id, role: row.role } : null;
  },

  async findForUser(userId: string): Promise<MembershipWithBusiness | null> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM business_users WHERE user_id = ?').get(userId) as BusinessUserRow | undefined;
    if (!row) return null;
    const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(row.business_id) as BusinessRow | undefined;
    if (!business) return null;
    return {
      role: row.role,
      // No plan/activation concept on desktop (see lib/plans.ts's
      // NEXT_PUBLIC_WALTI_DESKTOP_BUILD bypass) — these are always "fully
      // unlocked" placeholders, never actually consulted in desktop builds.
      business: {
        id: business.id,
        name: business.name,
        slug: null,
        logoUrl: null,
        isActive: true,
        planName: null,
        planExpiresAt: null,
      },
    };
  },
};
