import { NextResponse } from "next/server";
import { auth, isAuthConfigured } from "@/auth";

/**
 * Protects page routes once OAuth is configured. API routes self-guard via
 * `getUserId()` (which returns 401 JSON); `/api/auth` and `/login` stay public.
 * Until credentials exist the app stays in anonymous mode so nothing breaks.
 */
export default auth((req) => {
  if (!isAuthConfigured()) return NextResponse.next();

  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const isLoginPage = nextUrl.pathname === "/login";
  const isApi = nextUrl.pathname.startsWith("/api");

  if (!isLoggedIn && !isLoginPage && !isApi) {
    const login = new URL("/login", nextUrl);
    login.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
