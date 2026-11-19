import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for the studio: no session cookie → sign in. Real session
 * validation happens in every API route.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get("imw_session")) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/studio/:path*"] };
