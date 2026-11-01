// Atualiza a sessão quando o acesso da pessoa muda (áreas liberadas ou conta desativada)
import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, logout } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  const to = req.nextUrl.searchParams.get("to") || "/";
  const base = env.appUrl();
  if (!s) return NextResponse.redirect(new URL("/login", base));
  const u = await db.user.findUnique({ where: { id: s.userId } });
  if (!u || !u.active) { await logout(); return NextResponse.redirect(new URL("/login?erro=2", base)); }
  await createSession({ userId: u.id, name: u.name, role: u.role, areas: u.areas ?? [] });
  return NextResponse.redirect(new URL(to.startsWith("/") ? to : "/", base));
}
