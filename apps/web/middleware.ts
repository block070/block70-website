import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATTERNS = [
  /^\/wallets\/dashboard(?:\/.*)?$/,
  /^\/wallets\/tokens\/[^/]+(?:\/.*)?$/,
  /^\/wallets\/(bitcoin|ethereum|solana)\/[^/]+(?:\/.*)?$/,
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
  matcher: ["/wallets/:path*"],
};

