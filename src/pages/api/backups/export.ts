import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDataSource } from '@/lib/datasource';
import { createBackupArchive } from '@/lib/backup';

// Desktop-only — manual backup export (see src/lib/backup.ts). A backup
// contains password hashes for every staff login, so it's gated to ADMINs
// only, same as src/pages/api/business-users.ts.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.WALTI_RUNTIME !== 'desktop') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  const dataSource = await getDataSource();
  const membership = await dataSource.membership.find(userId, businessId);
  if (!membership || membership.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo un administrador puede generar backups' });
  }

  try {
    const buffer = createBackupArchive();
    const filename = `walti-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error creating backup', error);
    return res.status(500).json({ error: 'Error generando el backup' });
  }
}
