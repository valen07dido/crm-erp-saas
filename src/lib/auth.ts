import NextAuth, { type NextAuthOptions, type DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
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
    maxAge: 30 * 60, // 30 minutes
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
