import { DrizzleAdapter } from '@auth/drizzle-adapter';
import type { DefaultSession } from 'next-auth';
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { db } from '@/db/client';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'admin' | 'manager' | 'driver';
    } & DefaultSession['user'];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    sessionsTable: sessions,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? 'info@vffroid.ch',
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = (user as unknown as { role: 'admin' | 'manager' | 'driver' }).role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
    error: '/login/error',
  },
});
