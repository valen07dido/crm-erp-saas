import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No se pudo obtener el ID del usuario' });
  }

  try {
    // Find business user relation
    const businessUser = await prisma.businessUser.findFirst({
      where: { userId },
      include: {
        business: true,
      },
    });

    if (!businessUser) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    return res.status(200).json({
      business: businessUser.business,
    });
  } catch (error) {
    console.error('Error in /api/me:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}
