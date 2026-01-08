import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export async function middleware(request: NextRequest) {
  return auth(request as unknown as Parameters<typeof auth>[0]);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth (auth API routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|api/auth).*)",
  ],
};
