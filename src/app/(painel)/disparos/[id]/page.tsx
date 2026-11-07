// Editar um disparo que ainda não começou (ou que está pausado)
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { db } from "@/lib/db";
import { Header, Panel } from "@/components/ui";
import { DateTimeField, FileField } from "@/components/fields";
import { updateBroadcast } from "../../acoes2";

export const dynamic = "force-dynamic";

const local = (d: Date) => {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  return p.replace(" ", "T");
};

export default async function EditarDisparo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const b = await db.broadcast.findUnique({ where: { id } });
  if (!b) notFound();
  const editable = ["DRAFT", "SCHEDULED", "PAUSED"].includes(b.status);
  return (
    <>
      <Header title="Editar disparo" lede={`${b.total.toLocaleString("pt-BR")} pessoas · ${b.sent} já receberam`}>
        <Link className="btn" href="/disparos"><ArrowLeft size={15} /> Voltar</Link>
      </Header>
      {sp.erro === "texto" && <div className="err">Escreva a mensagem.</div>}
      {!editable && <div className="err">Esse disparo já está enviando ou terminou. Pause antes de editar.</div>}
      <Panel title="Mensagem">
        <form action={updateBroadcast} className="stack" style={{ gap: 12, maxWidth: 640 }}>
          <input type="hidden" name="id" value={b.id} />
          <div className="field">
            <label>Texto</label>
            <textarea className="in" name="text" defaultValue={b.text} style={{ minHeight: 160 }} disabled={!editable} />
            <span className="hint">{"{nome}"} vira o primeiro nome. {"{Oi|Olá|E aí}"} varia o texto para cada pessoa.</span>
          </div>
          {b.mediaUrl && (
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" name="removeMedia" disabled={!editable} /> Tirar o arquivo anexado ({b.mediaType === "video" ? "vídeo" : b.mediaType === "image" ? "imagem" : "arquivo"})
            </label>
          )}
          <FileField name="media" accept="image/*,video/*" hint={b.mediaUrl ? "Trocar o arquivo (opcional)" : "Foto ou vídeo (opcional)"} />
          <div className="field">
            <label>Quando</label>
            <DateTimeField name="sendAt" defaultValue={b.sendAt ? local(b.sendAt) : undefined} />
          </div>
          <button className="btn pri lg" type="submit" disabled={!editable} style={{ width: "100%", justifyContent: "center" }}><Save size={16} /> Salvar alterações</button>
        </form>
      </Panel>
    </>
  );
}
