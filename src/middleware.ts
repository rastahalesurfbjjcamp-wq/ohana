import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { env } from "@/lib/env";

const PUBLIC = ["/login", "/api/auth/login", "/api/webhooks", "/api/health", "/api/media", "/fonts", "/api/leads", "/g", "/votar", "/api/votar"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const token = req.cookies.get("hub_session")?.value;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(env.sessionSecret()));
      return NextResponse.next();
    } catch {
      /* sessão inválida */
    }
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?|ttf)$).*)"],
};
