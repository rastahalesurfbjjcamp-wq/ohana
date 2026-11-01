// Exporta a biblioteca de mensagens em JSON (para backup ou levar para outra loja)
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "login" }, { status: 401 });
  const rows = await db.messageTemplate.findMany({ orderBy: [{ folder: "asc" }, { name: "asc" }] });
  const out = rows.map((r) => ({ name: r.name, folder: r.folder, kind: r.kind, parts: r.parts }));
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="mensagens-${new Date().toISOString().slice(0, 10)}.json"` } });
}
