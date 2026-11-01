import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/ui";
import type { Part } from "@/lib/flowTypes";
import { EditorPage } from "./EditorPage";

export const dynamic = "force-dynamic";

export default async function Mensagem({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pasta?: string; tipo?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const t = id === "nova" ? null : await db.messageTemplate.findUnique({ where: { id } });
  if (id !== "nova" && !t) notFound();
  const folders = (await db.messageTemplate.findMany({ distinct: ["folder"], select: { folder: true } })).map((x) => x.folder).filter(Boolean).sort();
  const initial = t ? { id: t.id, name: t.name, folder: t.folder, kind: t.kind, parts: (t.parts ?? []) as Part[] } : { name: "", folder: sp.pasta ?? "", kind: sp.tipo ?? "nenhum", parts: [{ text: "" }] };
  const back = initial.folder ? `/mensagens?pasta=${encodeURIComponent(initial.folder)}` : "/mensagens";
  return (
    <>
      <Header title={t ? t.name : "Nova mensagem"} lede="Monte a mensagem em partes. Ela fica na biblioteca e pode ser usada em automações, campanhas, envio manual e atendimento.">
        <Link className="btn" href={back}><ArrowLeft size={15} /> Biblioteca</Link>
      </Header>
      <EditorPage initial={initial} folders={folders} />
    </>
  );
}
