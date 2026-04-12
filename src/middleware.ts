import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes - redirect to chat if already logged in
  if (pathname === "/login" || pathname === "/") {
    // Client-side redirect will handle auth check
    return NextResponse.next();
  }

  // All other routes are protected by default
  // Client-side auth check in layout will handle redirect
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
