// Script para colar no tema da Shopify
import { NextResponse } from "next/server";
import { POPUP_SCRIPT } from "@/lib/popupScript";

export const dynamic = "force-static";

export async function GET() {
  return new NextResponse(POPUP_SCRIPT, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
