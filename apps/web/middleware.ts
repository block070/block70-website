import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATTERNS = [
  /^\/wallets\/dashboard(?:\/.*)?$/,
  /^\/wallets\/tokens\/[^/]+(?:\/.*)?$/,
  /^\/wallets\/(bitcoin|ethereum|solana)\/[^/]+(?:\/.*)?$/,
  /^\/smartwallets\/(bitcoin|ethereum|solana)\/[^/]+(?:\/.*)?$/,
];

// Upland add-on surfaces that require an authenticated user at minimum.
// Server-side entitlement checks still run on every API route -- this is a
// coarse UX gate, not a security boundary.
const UPLAND_AUTH_REQUIRED_PATTERNS = [
  /^\/coins\/upland\/property-search\/alerts(?:\/.*)?$/,
  /^\/coins\/upland\/property-search\/portfolio(?:\/.*)?$/,
  /^\/coins\/upland\/property-search\/saved(?:\/.*)?$/,
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/crypto-hour" || pathname.startsWith("/crypto-hour/")) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/crypto-hour"
        ? "/crypto-on-the-hour"
        : `/crypto-on-the-hour${pathname.slice("/crypto-hour".length)}`;
    return NextResponse.redirect(url, 308);
  }

  const isUplandAuthRequired = UPLAND_AUTH_REQUIRED_PATTERNS.some((p) => p.test(pathname));
  if (isUplandAuthRequired) {
    const session = request.cookies.get("block70_session")?.value;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Tier enforcement still happens server-side (the API routes) -- we don't
    // read JWT claims in edge middleware to keep this synchronous + cheap.
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname));
  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get("block70_session")?.value;
  const plan = request.cookies.get("block70_plan")?.value;
  if (session && (plan === "pro" || plan === "admin")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/wallets/:path*",
    "/smartwallets/:path*",
    "/crypto-hour",
    "/crypto-hour/:path*",
    "/coins/upland/property-search/alerts/:path*",
    "/coins/upland/property-search/portfolio/:path*",
    "/coins/upland/property-search/saved/:path*",
  ],
};

