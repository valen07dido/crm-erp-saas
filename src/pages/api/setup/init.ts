import type { NextApiRequest, NextApiResponse } from 'next';
import { getDataSource } from '@/lib/datasource';

// Desktop-only bootstrap: creates the single seeded Business plus its first
// ADMIN user. Doesn't exist as a concept on the web/SaaS product (signup
// there goes through src/pages/auth/signup.tsx instead) — both GET and POST
// are no-ops unless WALTI_RUNTIME=desktop, so this can't be used to create
// an account on the hosted product.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.WALTI_RUNTIME !== 'desktop') {
    return res.status(404).json({ error: 'Not found' });
  }

  const dataSource = await getDataSource();

  if (req.method === 'GET') {
    const needsSetup = await dataSource.setup.needsInitialSetup();
    return res.status(200).json({ needsSetup });
  }

  if (req.method === 'POST') {
    const needsSetup = await dataSource.setup.needsInitialSetup();
    if (!needsSetup) {
      return res.status(409).json({ error: 'Ya hay un administrador configurado' });
    }

    const { businessName, email, username, password } = req.body as {
      businessName?: string;
      email?: string;
      username?: string;
      password?: string;
    };

    if (!businessName || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (username && !/^[a-z0-9_.-]{3,32}$/.test(username.toLowerCase())) {
      return res.status(400).json({ error: 'Usuario inválido (3-32 caracteres, minúsculas/números/._-)' });
    }

    try {
      const result = await dataSource.setup.createInitialAdmin({
        businessName,
        email: email.toLowerCase(),
        username: username || null,
        password,
      });
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error creando el administrador inicial' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
