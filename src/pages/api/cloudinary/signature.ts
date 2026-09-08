import type { NextApiRequest, NextApiResponse } from 'next';
import cloudinary from '@/lib/cloudinary';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Cloudinary no está configurado en el servidor' });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `crm-erp-saas/${businessId}`;

  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);

  return res.status(200).json({ signature, timestamp, apiKey, cloudName, folder });
}
