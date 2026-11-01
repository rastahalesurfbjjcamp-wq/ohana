import Link from "next/link";
import { Copy, Download, FileText, Folder, FolderOpen, Image as ImageIcon, LayoutGrid, List, Mic, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { WaText } from "@/components/MessageEditor";
import { AutoSubmitFile } from "@/components/AutoSubmitFile";
import { KINDS, type Flow, type Part } from "@/lib/flowTypes";
import { deleteTemplate, duplicateTemplate, importTemplates, moveTemplate, renameFolder } from "../acoes11";

export const dynamic = "force-dynamic";

const kindLabel = (k: string) => KINDS.find((x) => x.k === k)?.label ?? "Geral";

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ pasta?: string; tipo?: string; q?: string; v?: string; importadas?: string }> }) {
  const sp = await searchParams;
  const pasta = sp.pasta ?? null;
  const q = (sp.q ?? "").trim().toLowerCase();
  const view = sp.v === "lista" ? "lista" : "grade";
  const [all, autos] = await Promise.all([
    db.messageTemplate.findMany({ orderBy: [{ folder: "asc" }, { name: "asc" }] }),
    db.automation.findMany({ select: { id: true, name: true, flow: true } }),
  ]);
  // Onde cada mensagem é usada
  const used = new Map<string, string[]>();
  for (const a of autos) for (const n of Object.values(((a.flow ?? {}) as Flow).nodes ?? {})) if (n.type === "send" && n.messageId) used.set(n.messageId, [...(used.get(n.messageId) ?? []), a.name]);

  const match = (t: (typeof all)[number]) => (!sp.tipo || t.kind === sp.tipo) && (!q || `${t.name} ${JSON.stringify(t.parts)}`.toLowerCase().includes(q));
  const folders = [...new Set(all.map((t) => t.folder).filter(Boolean))];
  const items = all.filter((t) => match(t) && (q ? true : pasta !== null ? t.folder === pasta : !t.folder));
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { pasta: pasta ?? undefined, tipo: sp.tipo, q: sp.q, v: sp.v, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return `/mensagens${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Header title="Mensagens" lede="Biblioteca de mensagens do WhatsApp. Cada uma pode ser usada em automações, campanhas, envio manual e atendimento.">
        <a className="btn" href="/api/mensagens/export"><Download size={15} /> Exportar</a>
        <form action={importTemplates} className="row" style={{ gap: 0 }}>
          <AutoSubmitFile name="file" accept="application/json"><Upload size={15} /> Importar</AutoSubmitFile>
        </form>
        <Link className="btn pri" href={`/mensagens/nova${pasta ? `?pasta=${encodeURIComponent(pasta)}` : ""}`}><Plus size={16} /> Criar mensagem</Link>
      </Header>
      {sp.importadas && <div className="ok">{sp.importadas} mensagens importadas.</div>}

      <div className="ml-bar">
        <form className="ml-search" action="/mensagens">
          {pasta && <input type="hidden" name="pasta" value={pasta} />}
          {sp.tipo && <input type="hidden" name="tipo" value={sp.tipo} />}
          <input className="in" name="q" defaultValue={sp.q ?? ""} placeholder="Buscar pelo nome ou texto" />
        </form>
        <div className="chips">
          <Link className={!sp.tipo ? "on" : ""} href={href({ tipo: undefined })}>Todas</Link>
          {KINDS.map((k) => <Link key={k.k} className={sp.tipo === k.k ? "on" : ""} href={href({ tipo: k.k })}>{k.label}</Link>)}
        </div>
        <div className="seg" style={{ marginLeft: "auto" }}>
          <Link className={view === "grade" ? "on" : ""} href={href({ v: undefined })}><LayoutGrid size={14} /></Link>
          <Link className={view === "lista" ? "on" : ""} href={href({ v: "lista" })}><List size={14} /></Link>
        </div>
      </div>

      {pasta !== null && !q && (
        <div className="ml-crumb">
          <Link href={href({ pasta: undefined })}>Biblioteca</Link><span>/</span><FolderOpen size={15} /><b>{pasta}</b>
          <form action={renameFolder} className="row" style={{ gap: 6, marginLeft: "auto" }}>
            <input type="hidden" name="from" value={pasta} />
            <input className="in" name="to" defaultValue={pasta} style={{ height: 32, width: 220 }} aria-label="Nome da pasta" />
            <button className="btn sm" type="submit">Renomear pasta</button>
          </form>
        </div>
      )}

      {pasta === null && !q && folders.length > 0 && (
        <div className="ml-folders">
          {folders.map((f) => {
            const n = all.filter((t) => t.folder === f && match(t)).length;
            return <Link key={f} href={href({ pasta: f })} className="ml-folder"><Folder size={18} /><span>{f}</span><small>{n}</small></Link>;
          })}
        </div>
      )}

      {items.length ? (
        view === "grade" ? (
          <div className="ml-grid">
            {items.map((t) => {
              const parts = (t.parts ?? []) as Part[];
              const u = used.get(t.id) ?? [];
              return (
                <div key={t.id} className="ml-card">
                  <Link href={`/mensagens/${t.id}`} className="ml-prev">
                    {parts.slice(0, 3).map((p, i) => (
                      <div key={i} className="cv-bb">
                        {p.productImage && <div className="cv-img"><ImageIcon size={13} /> foto do produto</div>}
                        {p.mediaUrl && p.mediaType === "image" && <div className="cv-img"><img src={(p.mediaUrl ?? "").replace(/^https?:\/\/[^/]+/, "")} alt="" /></div>}
                        {p.mediaType === "audio" && <div className="cv-img"><Mic size={13} /> voz</div>}
                        {p.mediaUrl && (p.mediaType === "document" || p.mediaType === "video") && <div className="cv-img"><FileText size={13} /> {p.fileName ?? p.mediaType}</div>}
                        {p.text && <WaText text={p.text.length > 180 ? `${p.text.slice(0, 180)}…` : p.text} />}
                      </div>
                    ))}
                  </Link>
                  <div className="ml-foot">
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/mensagens/${t.id}`} className="ml-name">{t.name}</Link>
                      <div className="dim" style={{ fontSize: 11.5 }}>{kindLabel(t.kind)} · {parts.length} parte{parts.length === 1 ? "" : "s"}{u.length ? ` · em ${u.length} automaç${u.length === 1 ? "ão" : "ões"}` : ""}</div>
                    </div>
                    <details className="ml-menu">
                      <summary aria-label="Opções">⋮</summary>
                      <div>
                        <Link href={`/mensagens/${t.id}`}><Pencil size={13} /> Editar</Link>
                        <form action={duplicateTemplate}><input type="hidden" name="id" value={t.id} /><button type="submit"><Copy size={13} /> Duplicar</button></form>
                        <form action={moveTemplate} className="ml-move"><input type="hidden" name="id" value={t.id} /><input className="in" name="folder" list="ml-folders" defaultValue={t.folder} placeholder="Pasta" /><button type="submit">Mover</button></form>
                        <form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="folder" value={pasta ?? ""} /><ConfirmButton className="danger" message={u.length ? `Usada em: ${u.join(", ")}. Apagar mesmo assim?` : "Apagar esta mensagem?"}><Trash2 size={13} /> Excluir</ConfirmButton></form>
                      </div>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <section className="pnl" style={{ padding: 0 }}>
            <table className="tb">
              <thead><tr><th>Nome</th><th>Tipo</th><th>Pasta</th><th>Usada em</th><th>Atualizada</th></tr></thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/mensagens/${t.id}`} style={{ fontWeight: 600 }}>{t.name}</Link></td>
                    <td><span className="chip c-n">{kindLabel(t.kind)}</span></td>
                    <td className="dim">{t.folder || "-"}</td>
                    <td className="dim" style={{ fontSize: 12.5 }}>{(used.get(t.id) ?? []).join(", ") || "-"}</td>
                    <td className="dim">{t.updatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      ) : (
        <div className="empty-art"><FileText size={26} className="dim" /><div>{q || sp.tipo ? "Nada encontrado com esse filtro." : pasta ? "Pasta vazia." : "Nenhuma mensagem solta. Crie uma ou abra uma pasta."}</div></div>
      )}
      <datalist id="ml-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
    </>
  );
}
