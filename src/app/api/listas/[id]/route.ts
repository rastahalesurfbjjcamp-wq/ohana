// Outro sistema manda contatos para uma lista: POST com x-api-key
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { addToList } from "@/lib/automations";

const key = (id: string) => createHash("sha256").update(`lista:${id}:${env.sessionSecret()}`).digest("hex").slice(0, 32);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const got = Buffer.from(req.headers.get("x-api-key") ?? "");
  const want = Buffer.from(key(id));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "chave inválida" }, { status: 401 });
  if (!(await db.contactList.findUnique({ where: { id } }))) return NextResponse.json({ error: "lista não encontrada" }, { status: 404 });
  const b = (await req.json().catch(() => null)) as { contatos?: Record<string, unknown>[] } | Record<string, unknown> | null;
  const raw = (b && Array.isArray((b as { contatos?: unknown }).contatos) ? (b as { contatos: Record<string, unknown>[] }).contatos : b ? [b as Record<string, unknown>] : []).slice(0, 5000);
  const rows = raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), String(v ?? "").slice(0, 500)])));
  const added = await addToList(id, rows);
  return NextResponse.json({ ok: true, recebidos: rows.length, novos: added });
}
