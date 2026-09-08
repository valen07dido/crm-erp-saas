import type { NextApiRequest, NextApiResponse } from 'next';
import pdfParse from '@/lib/pdf-parse-safe';
import { parseInvoiceText } from '@/lib/invoice-parser';

export const config = {
  api: {
    bodyParser: { sizeLimit: '15mb' },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileBase64 } = req.body;
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing fileBase64' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const data = await pdfParse(buffer);
    const items = parseInvoiceText(data.text);

    return res.status(200).json({ rawText: data.text, items });
  } catch (error: any) {
    console.error('Error parsing invoice PDF', error);
    return res.status(500).json({ error: 'No se pudo leer el PDF' });
  }
}
