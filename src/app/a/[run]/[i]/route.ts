// Link rastreado das automações: conta o clique e leva para o link original
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ run: string; i: string }> }) {
  const { run, i } = await params;
  const r = await db.automationRun.findUnique({ where: { id: run }, select: { id: true, ctx: true, log: true } }).catch(() => null);
  const links = r ? (JSON.parse(((r.ctx ?? {}) as Record<string, string>)._links || "[]") as string[]) : [];
  const url = links[Number(i)];
  if (!r || !url) return NextResponse.redirect(env.appUrl(), 302);
  const ln = JSON.parse(((r.ctx ?? {}) as Record<string, string>)._ln || "[]") as string[];
  const log = ((r.log ?? []) as { at: string; t: string; n?: string }[]).concat({ at: new Date().toISOString(), t: "Clique", n: ln[Number(i)] || undefined }).slice(-30);
  await db.automationRun.update({ where: { id: r.id }, data: { clicks: { increment: 1 }, log } }).catch(() => null);
  return NextResponse.redirect(url, 302);
}
