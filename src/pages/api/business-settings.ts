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
          currency, taxRate,
          shiftMorningStartHour, shiftMorningEndHour, shiftNightStartHour, shiftNightEndHour,
          shiftMorningLabel, shiftNightLabel,
          ticketWidthMm, printTicketOnSale,
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
        };
        const clampHour = (h: number) => Math.min(23, Math.max(0, h));
        const settings = await prisma.businessSettings.upsert({
          where: { businessId },
          update: {
            ...(currency !== undefined && { currency }),
            ...(taxRate !== undefined && { taxRate }),
            ...(shiftMorningStartHour !== undefined && { shiftMorningStartHour: clampHour(shiftMorningStartHour) }),
            ...(shiftMorningEndHour !== undefined && { shiftMorningEndHour: clampHour(shiftMorningEndHour) }),
            ...(shiftNightStartHour !== undefined && { shiftNightStartHour: clampHour(shiftNightStartHour) }),
            ...(shiftNightEndHour !== undefined && { shiftNightEndHour: clampHour(shiftNightEndHour) }),
            ...(shiftMorningLabel !== undefined && { shiftMorningLabel }),
            ...(shiftNightLabel !== undefined && { shiftNightLabel }),
            ...(ticketWidthMm !== undefined && { ticketWidthMm: Math.min(300, Math.max(30, ticketWidthMm)) }),
            ...(printTicketOnSale !== undefined && { printTicketOnSale }),
          },
          create: {
            businessId,
            currency: currency ?? 'USD',
            taxRate: taxRate ?? 0,
            shiftMorningStartHour: shiftMorningStartHour !== undefined ? clampHour(shiftMorningStartHour) : 8,
            shiftMorningEndHour: shiftMorningEndHour !== undefined ? clampHour(shiftMorningEndHour) : 12,
            shiftNightStartHour: shiftNightStartHour !== undefined ? clampHour(shiftNightStartHour) : 16,
            shiftNightEndHour: shiftNightEndHour !== undefined ? clampHour(shiftNightEndHour) : 21,
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
