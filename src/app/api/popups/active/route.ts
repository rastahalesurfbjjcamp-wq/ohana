// Popups ligados, para o script do site
import { NextResponse } from "next/server";
import { publicPopups } from "@/lib/popups";
import { db } from "@/lib/db";
import { cors } from "../cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET() {
  const [popups, st] = await Promise.all([publicPopups().catch(() => []), db.setting.findUnique({ where: { key: "_popup_wa" } }).catch(() => null)]);
  const wa = (st?.value ?? null) as { on?: boolean; phone?: string; text?: string; label?: string; pos?: string } | null;
  return NextResponse.json({ popups, wa: wa?.on ? wa : null }, { headers: { ...cors, "Cache-Control": "public, max-age=30" } });
}
