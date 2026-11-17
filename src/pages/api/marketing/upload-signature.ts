import type { NextApiRequest, NextApiResponse } from 'next';
import cloudinary from '@/lib/cloudinary';
import { requireSuperAdmin } from '@/lib/server/superadmin-guard';

/** Signed direct-to-Cloudinary upload for Marketing Studio assets (images and videos). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireSuperAdmin(req, res))) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Cloudinary no está configurado en el servidor' });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'walti-marketing';
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);
  return res.status(200).json({ signature, timestamp, apiKey, cloudName, folder });
}
