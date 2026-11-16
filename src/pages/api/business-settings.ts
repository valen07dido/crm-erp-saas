import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';
import { requireBusinessMembership } from '@/lib/server/auth-guard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }
  if (!(await requireBusinessMembership(req, res, businessId))) return;

  const dataSource = await getDataSource();

  try {
    switch (req.method) {
      case 'GET': {
        const settings = await dataSource.businessSettings.get(businessId);
        return res.status(200).json(settings);
      }
      case 'PUT': {
        const {
          currency, taxRate,
          shiftMorningStartHour, shiftMorningEndHour, shiftNightStartHour, shiftNightEndHour,
          shiftMorningLabel, shiftNightLabel,
          ticketWidthMm, printTicketOnSale, printLeftOffsetMm,
        } = req.body as {
          currency?: string;
          taxRate?: number;
          shiftMorningStartHour?: number;
          shiftMorningEndHour?: number;
          shiftNightStartHour?: number;
          shiftNightEndHour?: number;
          shiftMorningLabel?: string;
          shiftNightLabel?: string;
          ticketWidthMm?: number;
          printTicketOnSale?: boolean;
          printLeftOffsetMm?: number;
        };
        const settings = await dataSource.businessSettings.update(businessId, {
          currency,
          taxRate,
          shiftMorningStartHour,
          shiftMorningEndHour,
          shiftNightStartHour,
          shiftNightEndHour,
          shiftMorningLabel,
          shiftNightLabel,
          ticketWidthMm,
          printTicketOnSale,
          printLeftOffsetMm,
        });
        return res.status(200).json(settings);
      }
      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('business-settings API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
