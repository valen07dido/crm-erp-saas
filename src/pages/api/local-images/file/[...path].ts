import type { NextApiRequest, NextApiResponse } from 'next';
import { readLocalImage } from '@/lib/local-images';

// Serves images saved by src/pages/api/local-images/upload.ts. No
// membership check here, same as Cloudinary's own URLs: whoever has the URL
// can view it, and <img> tags can't carry the x-business-id header this
// app's other routes rely on for scoping anyway. Fine for a 127.0.0.1-only
// desktop app that was never reachable off the machine to begin with.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.WALTI_RUNTIME !== 'desktop') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path: pathParam } = req.query;
  const segments = Array.isArray(pathParam) ? pathParam : pathParam ? [pathParam] : [];

  const result = readLocalImage(segments);
  if (!result) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).send(result.buffer);
}
