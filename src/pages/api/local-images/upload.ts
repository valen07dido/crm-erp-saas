import type { NextApiRequest, NextApiResponse } from 'next';
import { requireBusinessMembership } from '@/lib/server/auth-guard';
import { saveLocalImage } from '@/lib/local-images';

// Desktop-only — the web/SaaS product uploads straight to Cloudinary from
// the browser (see src/pages/api/cloudinary/signature.ts) and never hits
// this route. See src/lib/uploadImage.ts for which path the client takes.
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.WALTI_RUNTIME !== 'desktop') {
    return res.status(404).json({ error: 'Not found' });
  }

  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;

  const { contentType, dataBase64 } = req.body as { contentType?: string; dataBase64?: string };
  if (!contentType || !dataBase64) {
    return res.status(400).json({ error: 'Faltan datos de la imagen' });
  }

  try {
    const url = saveLocalImage(businessId, contentType, dataBase64);
    return res.status(201).json({ url });
  } catch (error: any) {
    console.error('Error saving local image', error);
    return res.status(400).json({ error: error.message || 'Error guardando la imagen' });
  }
}
