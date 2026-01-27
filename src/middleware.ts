import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextRequest, NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  const isLocalhostBase =
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "[::1]" ||
    host.startsWith("[::1]:");

  // Dev convenience: visiting `http://localhost:4000` should land on a real school subdomain.
  // This avoids accidentally defaulting to the wrong school when no subdomain is present.
  if (
    process.env.NODE_ENV !== "production" &&
    isLocalhostBase &&
    (pathname === "/" || pathname === "/login")
  ) {
    const port = host.includes(":") ? host.split(":").pop() : null;
    // Keep Playwright/perf tests (default `localhost:3000`) working with SNS creds,
    // while making `localhost:4000` land on Headstart by default.
    const defaultSubdomain =
      process.env.DEFAULT_DEV_SCHOOL_SUBDOMAIN ||
      (port === "4000" ? "headstart" : "sns");
    const targetHost = `${defaultSubdomain}.localhost${port ? `:${port}` : ""}`;
    const url = request.nextUrl.clone();
    url.host = targetHost;
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

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
