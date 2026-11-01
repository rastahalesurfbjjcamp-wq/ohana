import Link from "next/link";
import { Contact, Plus, Trash2, Upload } from "lucide-react";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { Header, Panel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createList, deleteList, importList, listToAutomation } from "../acoes10";
import { createDynamicList, refreshListNow } from "../acoes12";
import { RulesBuilder } from "./RulesBuilder";
import type { ARule } from "@/lib/audienceTypes";

export const dynamic = "force-dynamic";
const listKey = (id: string) => createHash("sha256").update(`lista:${id}:${env.sessionSecret()}`).digest("hex").slice(0, 32);

export default async function Listas({ searchParams }: { searchParams: Promise<{ id?: string; importados?: string; linhas?: string; enviados?: string; desligada?: string; atualizada?: string }> }) {
  const sp = await searchParams;
  const lists = await db.contactList.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { members: true } } } });
  const cur = sp.id ? lists.find((l) => l.id === sp.id) : null;
  const [members, autos] = cur ? await Promise.all([
    db.listMember.findMany({ where: { listId: cur.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.automation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
  ]) : [[], []];
  const cols = [...new Set(members.flatMap((m) => Object.keys((m.fields ?? {}) as object)))].slice(0, 4);
  const api = cur ? `${env.appUrl().replace(/\/$/, "")}/api/listas/${cur.id}` : "";
  return (
    <>
      <Header title="Listas" lede="Grupos de contatos para campanhas e sequências: por regra (atualiza sozinha), por planilha, colando os números ou pela API.">
        <form action={createDynamicList} className="row" style={{ gap: 6 }}><input className="in" name="name" placeholder="Nome da lista por regra" style={{ width: 200 }} required /><button className="btn pri" type="submit"><Plus size={15} /> Lista por regra</button></form>
        <form action={createList} className="row" style={{ gap: 6 }}><input className="in" name="name" placeholder="Nome da lista manual" style={{ width: 190 }} required /><button className="btn" type="submit"><Plus size={15} /> Lista manual</button></form>
      </Header>
      {sp.atualizada && <div className="ok">Lista atualizada: {sp.atualizada} pessoas.</div>}
      {sp.importados && <div className="ok">{sp.importados} contato(s) novo(s) na lista{Number(sp.linhas) > Number(sp.importados) ? ` (${Number(sp.linhas) - Number(sp.importados)} linha(s) sem telefone válido ou já estavam)` : ""}.</div>}
      {sp.enviados && <div className="ok">{sp.enviados} contato(s) colocados na automação.{sp.desligada ? " A automação está desligada: ligue para as mensagens saírem." : " As mensagens saem aos poucos, com a proteção do número."}</div>}
      <div className="cols" style={{ gridTemplateColumns: "minmax(240px, 300px) minmax(0, 1fr)", alignItems: "start" }}>
        <section className="pnl" style={{ padding: 14 }}>
          {lists.length ? lists.map((l) => (
            <Link key={l.id} href={`/listas?id=${l.id}`} className={`lrow${cur?.id === l.id ? " sel" : ""}`} style={{ color: "inherit", padding: "10px 8px", borderRadius: 10, background: cur?.id === l.id ? "rgba(52,194,106,.08)" : undefined }}>
              <span className="tile sm t-k"><Contact size={15} /></span><div><div className="t">{l.name}</div><div className="s">{l._count.members} contato(s){l.dynamic ? " · por regra" : ""}</div></div>
            </Link>
          )) : <div className="dim" style={{ fontSize: 13, padding: 8 }}>Nenhuma lista. Crie a primeira no topo.</div>}
        </section>
        {cur ? (
          <div className="stack" style={{ gap: 16 }}>
            <Panel title={cur.name} sub={`${cur._count.members} contato(s)`} right={<form action={deleteList}><input type="hidden" name="id" value={cur.id} /><ConfirmButton className="btn sm ghost danger" message={`Apagar a lista "${cur.name}" e os contatos dela?`}><Trash2 size={14} /></ConfirmButton></form>}>
              {cur.dynamic ? (
                <div className="stack" style={{ gap: 10 }}>
                  <RulesBuilder listId={cur.id} initial={(cur.rules ?? []) as ARule[]} mode={cur.mode} lists={lists.map((l) => ({ id: l.id, name: l.name }))} />
                  <div className="row" style={{ gap: 8 }}>
                    <form action={refreshListNow}><input type="hidden" name="id" value={cur.id} /><button className="btn sm" type="submit">Atualizar agora</button></form>
                    <Link className="btn sm" href={`/campanhas-whatsapp?nova=1&lista=${cur.id}`}>Criar campanha para esta lista</Link>
                    {cur.refreshedAt && <small className="dim" style={{ alignSelf: "center" }}>Atualizada {cur.refreshedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>}
                  </div>
                </div>
              ) : (
              <form action={importList} className="stack" style={{ gap: 8 }}>
                <input type="hidden" name="listId" value={cur.id} />
                <b style={{ fontSize: 13 }}><Upload size={14} /> Subir planilha (CSV) ou colar</b>
                <input type="file" name="file" accept=".csv,text/csv,text/plain" />
                <textarea className="in" name="paste" rows={4} placeholder={"nome,telefone,link\nJoão Silva,21999999999,https://rastahale.com.br/products/...\n\nou só os números, um por linha"} />
                <small className="dim">A primeira linha tem os nomes das colunas: nome, telefone (ou whatsapp), email e o que mais quiser. Cada coluna extra vira um campo na mensagem, ex.: a coluna link vira {"{link}"}. Quem entra na lista dispara as automações com o gatilho &quot;Adicionado à lista&quot;.</small>
                <div><button className="btn pri sm" type="submit">Adicionar à lista</button></div>
              </form>
              )}
            </Panel>
            <Panel title="Disparar uma automação para a lista toda" sub="Coloca todos os contatos de agora na sequência escolhida">
              {autos.length ? (
                <form action={listToAutomation} className="row" style={{ gap: 8 }}>
                  <input type="hidden" name="listId" value={cur.id} />
                  <select className="in" name="automationId" style={{ flex: 1 }}>{autos.map((a) => <option key={a.id} value={a.id}>{a.name}{a.active ? "" : " (desligada)"}</option>)}</select>
                  <ConfirmButton className="btn pri sm" message={`Colocar os ${cur._count.members} contatos nesta automação?`}>Disparar</ConfirmButton>
                </form>
              ) : <div className="dim" style={{ fontSize: 13 }}>Crie uma automação primeiro em <Link href="/automacoes?novo=1" style={{ textDecoration: "underline" }}>Automações</Link>.</div>}
            </Panel>
            <Panel title="Pela API" sub="Para outro sistema mandar contatos direto para esta lista">
              <div className="stack" style={{ gap: 6, fontSize: 13 }}>
                <div className="row" style={{ gap: 8 }}><code style={{ flex: 1, overflowWrap: "anywhere" }}>POST {api}</code><CopyButton className="btn sm" text={api} /></div>
                <div className="row" style={{ gap: 8 }}><code style={{ flex: 1 }}>x-api-key: {listKey(cur.id).slice(0, 6)}••••••</code><CopyButton className="btn sm" text={listKey(cur.id)} label="Copiar chave" /></div>
                <small className="dim">Corpo em JSON: {`{ "contatos": [{ "nome": "João", "telefone": "21999999999", "link": "https://..." }] }`}</small>
              </div>
            </Panel>
            <Panel title="Contatos" sub={cur._count.members > 100 ? `Mostrando 100 de ${cur._count.members}` : undefined} body={false}>
              {members.length ? (
                <div style={{ overflowX: "auto" }}><table className="tb"><thead><tr><th>Nome</th><th>WhatsApp</th>{cols.map((c) => <th key={c}>{c}</th>)}<th>Entrou</th></tr></thead>
                  <tbody>{members.map((m) => <tr key={m.id}><td>{m.name ?? "-"}</td><td>{formatPhone(m.phone)}</td>{cols.map((c) => <td key={c} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{((m.fields ?? {}) as Record<string, string>)[c] ?? ""}</td>)}<td className="mut">{m.createdAt.toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table></div>
              ) : <div className="empty" style={{ padding: 20 }}>Lista vazia. Suba uma planilha ou cole os números acima.</div>}
            </Panel>
          </div>
        ) : <section className="pnl empty-art" style={{ padding: 30 }}><Contact size={26} className="dim" /><div>Escolha uma lista ao lado ou crie uma nova.</div></section>}
      </div>
    </>
  );
}
