import NextAuth, { type NextAuthOptions, type DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Email o Usuario', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;
        // Emails and usernames are always stored lowercase — normalize the
        // typed value so login doesn't care about case (e.g. "Test" vs "test").
        const normalizedIdentifier = credentials.identifier.toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: normalizedIdentifier },
              { username: normalizedIdentifier },
            ],
          },
        });
        if (!user) return null;

        const isValid = bcrypt.compareSync(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, name: user.name ?? undefined, email: user.email };
      },
    }),
  ],
  // NOTE: Do NOT use PrismaAdapter with CredentialsProvider + JWT strategy
  // The adapter expects database sessions, which conflicts with JWT
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 hour
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/login',
    newUser: '/auth/signup',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist user ID in the JWT token on first sign-in
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Include user id in session
      if (session.user) {
        (session.user as any).id = token.sub as string;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
