// Mensagens para mandar na mão (botões nos pedidos e carrinhos)
import Link from "next/link";
import { ImageIcon, Plus, Trash2, X } from "lucide-react";
import { Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { QUICK_VARS, quickMessages, type QuickPart } from "@/lib/quick";
import { deleteQuickMessage, saveQuickMessage, toggleQuickMessage } from "../acoes9";

const SHOW: Record<string, string> = { todos: "todos os pedidos", pendente: "aguardando pagamento", pago: "pagos, ainda sem rastreio", enviado: "enviados (com rastreio)" };

export async function QuickEditor({ edit, n }: { edit?: string; n?: string }) {
  const list = await quickMessages();
  const cur = edit && edit !== "novo" ? list.find((m) => m.id === edit) : null;
  const parts = ((cur?.parts ?? []) as QuickPart[]);
  const count = Math.min(6, Math.max(1, Number(n) || parts.length || (edit === "novo" ? 3 : 1)));
  return (
    <section id="manuais">
      <Panel title="Mensagens para mandar na mão" sub="Aparecem como botões de WhatsApp nos pedidos e nos carrinhos abandonados. Clicou, enviou, o botão fica verde." right={<Link className="btn sm pri" href="/modelos?manual=novo#manuais"><Plus size={14} /> Nova mensagem</Link>}>
        {edit && (
          <form action={saveQuickMessage} className="stack" style={{ gap: 10, marginBottom: 16, padding: 14, border: "1px solid var(--line)", borderRadius: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><b>{cur ? `Editar: ${cur.name}` : "Nova mensagem"}</b><Link className="menu-b" href="/modelos#manuais" aria-label="Fechar"><X size={15} /></Link></div>
            {cur && <input type="hidden" name="id" value={cur.id} />}
            <input type="hidden" name="n" value={count} />
            <div className="row" style={{ gap: 10 }}>
              <div className="field" style={{ flex: 2, minWidth: 200 }}><label>Nome (aparece ao passar o mouse no botão)</label><input className="in" name="name" defaultValue={cur?.name ?? ""} placeholder="Ex.: Recuperação de boleto" required /></div>
              <div className="field" style={{ flex: 1, minWidth: 150 }}><label>Onde aparece</label><select className="in" name="kind" defaultValue={cur?.kind ?? "pedido"}><option value="pedido">Pedidos</option><option value="carrinho">Carrinhos abandonados</option></select></div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Em quais pedidos</label><select className="in" name="show" defaultValue={cur?.show ?? "todos"}>{Object.entries(SHOW).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            </div>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="seq-part" style={{ gap: 8 }}>
                <b style={{ fontSize: 13 }}>Parte {i + 1}</b>
                <textarea className="in" name={`text_${i}`} rows={i === 0 ? 5 : 3} defaultValue={parts[i]?.text ?? ""} placeholder="Texto ou link. Use {nome}, {produtos}, {valor}, {link}..." />
                <div className="row" style={{ gap: 14, fontSize: 13 }}>
                  <label className="check"><input type="checkbox" name={`img_${i}`} defaultChecked={!!parts[i]?.productImage} /> Foto do produto</label>
                  <input type="file" name={`file_${i}`} accept="image/*,video/*,application/pdf" style={{ fontSize: 12.5 }} />
                  {parts[i]?.mediaUrl && <label className="check"><input type="checkbox" name={`keep_${i}`} value="1" defaultChecked /> manter arquivo atual</label>}
                </div>
              </div>
            ))}
            <div className="row" style={{ gap: 8 }}>
              {count < 6 && <Link className="btn sm" href={`/modelos?manual=${cur?.id ?? "novo"}&n=${count + 1}#manuais`}><Plus size={14} /> Mais uma parte</Link>}
              <span className="dim" style={{ fontSize: 12 }}>Campos: {QUICK_VARS.join(" ")}. Pedido: {"{link}"} é a página do pedido, com o Pix ou boleto. Carrinho: {"{link}"} é o checkout.</span>
            </div>
            <div><button className="btn pri sm" type="submit">Salvar mensagem</button></div>
          </form>
        )}
        {list.map((m) => {
          const ps = (m.parts ?? []) as QuickPart[];
          return (
            <div className="lrow" key={m.id} style={!m.active ? { opacity: 0.5 } : undefined}>
              <span className="qb-i on" style={{ cursor: "default" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5" /></svg></span>
              <div style={{ flex: 1, minWidth: 0 }}><div className="t">{m.name}</div><div className="s">{m.kind === "carrinho" ? "Carrinhos abandonados" : `Pedidos ${SHOW[m.show] ?? ""}`} · {ps.length} parte{ps.length > 1 ? "s" : ""}{ps.some((p) => p.productImage || p.mediaUrl) ? " · com imagem" : ""} · {(ps.find((p) => p.text)?.text ?? "").slice(0, 70)}</div></div>
              <span className="end row" style={{ gap: 6, justifyContent: "flex-end" }}>
                <Link className="btn sm ghost" href={`/modelos?manual=${m.id}#manuais`}>Editar</Link>
                <form action={toggleQuickMessage}><input type="hidden" name="id" value={m.id} /><button className="btn sm ghost" type="submit">{m.active ? "Esconder" : "Mostrar"}</button></form>
                <form action={deleteQuickMessage}><input type="hidden" name="id" value={m.id} /><ConfirmButton className="btn sm ghost danger" message={`Apagar "${m.name}"?`}><Trash2 size={14} /></ConfirmButton></form>
              </span>
            </div>
          );
        })}
        <p className="dim" style={{ fontSize: 12, marginTop: 10 }}><ImageIcon size={12} /> &quot;Foto do produto&quot; manda a foto do primeiro produto do carrinho ou do pedido.</p>
      </Panel>
    </section>
  );
}
