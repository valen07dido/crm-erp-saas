import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDataSource } from '@/lib/datasource';
import { restoreBackupArchive } from '@/lib/backup';

// Desktop-only — manual backup restore (see src/lib/backup.ts). Raw binary
// body (the .zip itself), not JSON/base64 — a backup bundles the whole
// local database plus every product image, which can add up; base64 would
// add ~33% for no benefit here since there's no multipart form involved.
export const config = {
  api: { bodyParser: false },
};

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.WALTI_RUNTIME !== 'desktop') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (req.method !== 'POST') {
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
    return res.status(403).json({ error: 'Solo un administrador puede restaurar un backup' });
  }

  try {
    const buffer = await readRawBody(req);
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Archivo de backup vacío' });
    }
    const result = restoreBackupArchive(buffer);
    return res.status(200).json({ ok: true, safetyBackupPath: result.safetyBackupPath });
  } catch (error: any) {
    console.error('Error restoring backup', error);
    return res.status(400).json({ error: error.message || 'Error restaurando el backup' });
  }
}
