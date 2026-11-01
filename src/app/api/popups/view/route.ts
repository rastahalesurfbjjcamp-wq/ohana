// Conta uma exibição
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cors } from "../cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (id) await db.popup.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => null);
  return new NextResponse(null, { status: 204, headers: cors });
}
