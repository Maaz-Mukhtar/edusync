import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

// Edge-compatible auth config (no Node.js crypto dependencies)
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [], // Providers are added in auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.schoolId = (user as { schoolId: string }).schoolId;
        token.schoolSubdomain = (user as { schoolSubdomain: string }).schoolSubdomain;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.schoolId = token.schoolId as string;
        session.user.schoolSubdomain = token.schoolSubdomain as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/admin') ||
                           nextUrl.pathname.startsWith('/teacher') ||
                           nextUrl.pathname.startsWith('/student') ||
                           nextUrl.pathname.startsWith('/parent');
      const isOnLogin = nextUrl.pathname === '/login';

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      } else if (isOnLogin) {
        if (isLoggedIn) {
          // Redirect to appropriate dashboard
          const role = auth?.user?.role as UserRole;
          const dashboardPaths: Record<UserRole, string> = {
            SUPER_ADMIN: '/admin',
            ADMIN: '/admin',
            TEACHER: '/teacher',
            STUDENT: '/student',
            PARENT: '/parent',
          };
          return Response.redirect(new URL(dashboardPaths[role] || '/admin', nextUrl));
        }
        return true;
      }
      return true;
    },
  },
};
