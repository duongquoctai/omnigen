import { Effect } from "effect";
import { NextRequest, NextResponse } from "next/server";

import { verifySessionToken } from "@/contexts/access";
import { resolveAuthSecret } from "@/platform/auth-secret";

const AUTH_COOKIE_NAME = "lachvid_token";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/icon.svg") ||
    pathname.startsWith("/fonts") ||
    pathname === "/login"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = resolveAuthSecret();
  const isAuthenticated =
    token && secret
      ? await Effect.runPromise(
          verifySessionToken({
            token,
            secret,
            nowEpochSec: Math.floor(Date.now() / 1000),
          }),
        )
      : false;

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại." },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
