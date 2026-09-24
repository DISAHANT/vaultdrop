import { type NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';


const providers: any[] = [
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() },
      });

      if (!user || !user.passwordHash) return null;

      const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValid) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.avatarUrl,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          const email = user.email.toLowerCase();
          let dbUser = await prisma.user.findUnique({
            where: { email },
          });

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email,
                name: user.name || email.split('@')[0],
                avatarUrl: user.image || null,
              },
            });
          } else if (user.image && !dbUser.avatarUrl) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { avatarUrl: user.image },
            });
          }
          user.id = dbUser.id;
        } catch (err) {
          console.error('Error syncing Google user to DB:', err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (!token.id && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: (token.email as string).toLowerCase() },
            select: { id: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          (session.user as { id?: string }).id = token.id as string;
        } else if (session.user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: session.user.email.toLowerCase() },
              select: { id: true },
            });
            if (dbUser) {
              (session.user as { id?: string }).id = dbUser.id;
            }
          } catch {}
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Resolves the authenticated user from the server session,
 * guaranteeing the exact database User ID is returned.
 */
export async function getSessionUser() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; email?: string | null; name?: string | null; image?: string | null } | undefined;
    if (!user) return null;

    let userId = user.id;
    if (!userId && user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { id: true, email: true, name: true, avatarUrl: true },
      });
      if (dbUser) userId = dbUser.id;
    } else if (userId && user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!dbUser) {
        const byEmail = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { id: true },
        });
        if (byEmail) userId = byEmail.id;
      }
    }

    if (!userId) return null;
    return {
      id: userId,
      email: user.email || '',
      name: user.name || '',
      image: user.image || null,
    };
  } catch (err) {
    console.error('getSessionUser resolution error:', err);
    return null;
  }
}

