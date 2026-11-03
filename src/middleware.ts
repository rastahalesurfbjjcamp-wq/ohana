import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { env } from "@/lib/env";
import { canSee, firstAllowed } from "@/lib/access";

const PUBLIC = ["/login", "/cadastro-equipe", "/recuperar-senha", "/api/auth/login", "/api/webhooks", "/api/health", "/api/media", "/fonts", "/api/leads", "/convite", "/parceiro", "/api/parceiro", "/embaixador", "/api/avise", "/r", "/g", "/votar", "/api/votar", "/assinar", "/api/clube", "/club", "/a", "/api/listas", "/demo", "/brand", "/clube-loja.js", "/icon.png", "/apple-icon.png", "/favicon.ico"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // demonstração: logo neutro no lugar do leão
  if (process.env.DEMO_MODE === "1" && (pathname === "/brand/lion.png" || pathname === "/brand/logo.png" || pathname === "/icon.png" || pathname === "/apple-icon.png" || pathname === "/favicon.ico")) {
    const url = req.nextUrl.clone(); url.pathname = pathname.startsWith("/brand/") ? "/demo/mark.png" : "/demo/icon.png"; return NextResponse.rewrite(url);
  }
  // embaixador.rastahale.tech: a página de cadastro fica na raiz do subdomínio
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  if (host.startsWith("embaixador.") && pathname === "/") { const url = req.nextUrl.clone(); url.pathname = "/embaixador"; return NextResponse.rewrite(url); }
  if (host.startsWith("embaixador.") && pathname === "/entrar") { const url = req.nextUrl.clone(); url.pathname = "/parceiro/entrar"; return NextResponse.redirect(url); }
  // entrada do painel: rastahale.tech/admin (o antigo /login leva para lá)
  if (pathname === "/admin") { const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.rewrite(url); }
  if (pathname === "/admin/senha") { const url = req.nextUrl.clone(); url.pathname = "/recuperar-senha"; return NextResponse.rewrite(url); }
  if (pathname === "/admin/cadastro") { const url = req.nextUrl.clone(); url.pathname = "/cadastro-equipe"; return NextResponse.rewrite(url); }
  if (pathname === "/login") { const url = req.nextUrl.clone(); url.pathname = "/admin"; return NextResponse.redirect(url); }
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const token = req.cookies.get("hub_session")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(env.sessionSecret()));
      const p = payload as { role?: string; areas?: string[] };
      // equipe só abre as páginas liberadas para ela
      if (!pathname.startsWith("/api/") && !pathname.startsWith("/brand") && !canSee(pathname, p.role, p.areas)) {
        const url = req.nextUrl.clone();
        url.pathname = firstAllowed(p.role, p.areas);
        url.search = "";
        if (url.pathname !== pathname) return NextResponse.redirect(url);
      }
      return NextResponse.next();
    } catch {
      /* sessão inválida */
    }
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/admin";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?|ttf)$).*)", "/brand/:path*", "/clube-loja.js", "/icon.png", "/apple-icon.png", "/favicon.ico"],
};
