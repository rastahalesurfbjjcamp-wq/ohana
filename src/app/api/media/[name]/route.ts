// Arquivos enviados nos agendamentos. A Evolution busca a mídia por este link.
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadDir, mimeFor } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/.test(name)) return new NextResponse("não encontrado", { status: 404 });
  try {
    const buf = await readFile(path.join(uploadDir(), name));
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": mimeFor(name), "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new NextResponse("não encontrado", { status: 404 });
  }
}
