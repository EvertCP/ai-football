import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

function isAdminEmail(email: string): boolean {
  return Boolean(process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase());
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Email y contraseña',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!prisma || !credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user?.passwordHash || !(await compare(credentials.password, user.passwordHash))) return null;
        if (!user.emailVerified) throw new Error('EmailNoVerificado');
        const role = isAdminEmail(user.email) && user.emailVerified && user.role !== 'ADMIN'
          ? (await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })).role
          : user.role;
        return { id: user.id, name: user.name, email: user.email, image: user.image, role };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!prisma || !user.email) return false;
      if (account?.provider === 'google') {
        try {
          const email = user.email.toLowerCase();
          const role = isAdminEmail(email) ? 'ADMIN' : undefined;
          const storedUser = await prisma.user.upsert({
            where: { email },
            update: { name: user.name ?? null, image: user.image ?? null, emailVerified: new Date(), role },
            create: { email, name: user.name ?? null, image: user.image ?? null, emailVerified: new Date(), role: role || 'USER' },
          });
          user.id = storedUser.id;
          user.role = storedUser.role;
        } catch (error) {
          console.error('[Auth] Failed to persist Google user:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      } else if (prisma && token.email) {
        const storedUser = await prisma.user.findUnique({ where: { email: token.email.toLowerCase() } });
        if (storedUser) {
          token.id = storedUser.id;
          token.role = isAdminEmail(storedUser.email) && storedUser.emailVerified && storedUser.role !== 'ADMIN'
            ? (await prisma.user.update({ where: { id: storedUser.id }, data: { role: 'ADMIN' } })).role
            : storedUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = String(token.role || 'USER');
      }
      return session;
    },
  },
};
