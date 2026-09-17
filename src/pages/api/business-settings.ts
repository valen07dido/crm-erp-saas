import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const businessId = req.headers['x-business-id'];
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'Missing x-business-id header' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const settings = await prisma.businessSettings.upsert({
          where: { businessId },
          update: {},
          create: { businessId },
        });
        return res.status(200).json(settings);
      }
      case 'PUT': {
        const {
          currency, taxRate, shiftCutoffHour, shiftMorningLabel, shiftNightLabel,
          ticketWidthMm, printTicketOnSale,
        } = req.body as {
          currency?: string;
          taxRate?: number;
          shiftCutoffHour?: number;
          shiftMorningLabel?: string;
          shiftNightLabel?: string;
          ticketWidthMm?: number;
          printTicketOnSale?: boolean;
        };
        const settings = await prisma.businessSettings.upsert({
          where: { businessId },
          update: {
            ...(currency !== undefined && { currency }),
            ...(taxRate !== undefined && { taxRate }),
            ...(shiftCutoffHour !== undefined && { shiftCutoffHour: Math.min(23, Math.max(0, shiftCutoffHour)) }),
            ...(shiftMorningLabel !== undefined && { shiftMorningLabel }),
            ...(shiftNightLabel !== undefined && { shiftNightLabel }),
            ...(ticketWidthMm !== undefined && { ticketWidthMm: Math.min(300, Math.max(30, ticketWidthMm)) }),
            ...(printTicketOnSale !== undefined && { printTicketOnSale }),
          },
          create: {
            businessId,
            currency: currency ?? 'USD',
            taxRate: taxRate ?? 0,
            shiftCutoffHour: shiftCutoffHour ?? 14,
            shiftMorningLabel: shiftMorningLabel ?? 'Turno Mañana',
            shiftNightLabel: shiftNightLabel ?? 'Turno Noche',
            ticketWidthMm: ticketWidthMm ?? 58,
            printTicketOnSale: printTicketOnSale ?? true,
          },
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
