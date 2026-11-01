"use client";
// Editor de automações em tela livre: blocos arrastáveis, saídas por bolinha, ligações e painel lateral.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, BarChart3, Bell, CalendarClock, CalendarDays, ChevronDown, ChevronUp, Clock, Copy, FlaskConical, GitBranch, Headset, Hourglass, Image as ImageIcon, Library, ListPlus, LogOut, Maximize2, MessageCircle,
  Minus, Paperclip, Pencil, Plus, Shuffle, Split, StickyNote, Tag, Trash2, Undo2, Webhook, Workflow, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { BLOCKS, CHECKS, TRIGGERS, VARS, blockMeta, newNode, portsOf, type Branch, type Flow, type Node, type NodeType, type Part, type Port, type Rule } from "@/lib/flowTypes";
import { MessageEditor, PhonePreview, WaText, type TemplateData } from "@/components/MessageEditor";
import { saveFlowAction, setAutomationActive, uploadPartMedia } from "../../acoes10";
import { testAutomation } from "../../acoes11";

type Meta = { name: string; trigger: string; config: { delayMin?: number; listId?: string; stopOnPaid?: boolean } };
type Stats = Record<string, { sent: number; clicks: number; replied: number }>;
type Person = { id: string; name: string; status: string };
export type Tpl = { id: string; name: string; folder: string; kind: string; parts: Part[] };
type Opt = { id: string; name: string };
type Extra = { templates: Tpl[]; automations: Opt[]; users: string[]; groups: Opt[] };
type Props = {
  id: string; active: boolean; meta: Meta; flow: Flow; lists: Opt[]; stats: Stats; people: Person[];
  totals: { entered: number; sent: number; clickPct: number; value: string };
} & Extra;
type Sel = { kind: "node"; id: string } | { kind: "edge"; from: string; port: string } | null;
type Pt = { x: number; y: number };

const START = "__start";
const W = 256;
const ICON: Record<string, ReactNode> = {
  send: <MessageCircle size={15} />, wait: <Clock size={15} />, waitHour: <CalendarClock size={15} />, cond: <GitBranch size={15} />,
  random: <Shuffle size={15} />, tag: <Tag size={15} />, list: <ListPlus size={15} />, exit: <LogOut size={15} />, note: <StickyNote size={15} />,
  waitDate: <CalendarDays size={15} />, waitUntil: <Hourglass size={15} />, multi: <Split size={15} />, chat: <Headset size={15} />, goto: <Workflow size={15} />, notify: <Bell size={15} />, webhook: <Webhook size={15} />,
};
const TONE_COLOR: Record<Port["tone"], string> = { n: "#7d8781", l: "#34c26a", c: "#ef4444", s: "#f7c928", k: "#60a5fa", p: "#a78bfa" };
const EDGE_LABEL: Record<string, string> = { yes: "Sim", no: "Não", clicked: "Clicou", replied: "Respondeu", noReply: "Não respondeu", timeout: "Prazo", a: "A", b: "B", else: "Senão" };
const edgeLabel = (k: string, label: string) => EDGE_LABEL[k] ?? (k.startsWith("m") ? label.split(" ")[0] : k === "met" ? label : "");
const HIDE_KIND = new Set(["cond", "multi", "random", "exit"]);
const CHAT_ACT: Record<string, string> = { transfer: "Transferir para", archive: "Arquivar conversa", note: "Nota interna", ai_on: "Ligar robô de IA", ai_off: "Desligar robô de IA" };
const EVENT: Record<string, string> = { pagou: "pagar", respondeu: "responder", clicou: "clicar" };
const UNIT: Record<string, string> = { min: "minuto(s)", h: "hora(s)", d: "dia(s)" };
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIMEOUTS = [5, 15, 30, 60, 120, 240, 480, 720, 1440, 2880, 4320];
const fmtMin = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} dia${m >= 2880 ? "s" : ""}`);
const rid = () => Math.random().toString(36).slice(2, 9);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Fluxos antigos não têm posição: arruma em colunas a partir do gatilho
function layout(flow: Flow): Flow {
  const f = clone(flow);
  if (!f.startPos) f.startPos = { x: 60, y: 200 };
  if (Object.values(f.nodes).every((n) => typeof n.x === "number")) return f;
  const depth: Record<string, number> = {};
  const q: [string | undefined, number][] = [[f.start, 0]];
  while (q.length) {
    const [id, d] = q.shift()!;
    if (!id || !f.nodes[id] || depth[id] !== undefined) continue;
    depth[id] = d;
    for (const p of portsOf(f.nodes[id])) q.push([(f.nodes[id] as Record<string, unknown>)[p.k] as string | undefined, d + 1]);
  }
  const rows: Record<number, number> = {};
  for (const [id, n] of Object.entries(f.nodes)) {
    if (typeof n.x === "number") continue;
    const d = depth[id] ?? 0;
    const r = (rows[d] = (rows[d] ?? -1) + 1);
    n.x = f.startPos.x + 320 * (d + 1);
    n.y = f.startPos.y - 40 + r * 300;
  }
  return f;
}

type Ctx = { lists: Map<string, string>; tpl: Map<string, Tpl>; autos: Map<string, string> };
const ruleText = (rules: Rule[], mode: "all" | "any" | undefined, c: Ctx) => rules.map((r) => `${CHECKS.find((x) => x.k === r.check)?.label ?? r.check}${r.value ? ` ${r.check === "lista" ? c.lists.get(r.value) ?? "" : r.value}` : ""}`).join(mode === "any" ? " ou " : " e ");
const partsFor = (n: Extract<Node, { type: "send" }>, c: Ctx) => (n.messageId ? c.tpl.get(n.messageId)?.parts ?? [] : n.parts);
function title(n: Node, c: Ctx) {
  if (n.title) return n.title;
  if (n.type === "send") return n.messageId ? c.tpl.get(n.messageId)?.name ?? "Mensagem apagada" : (n.parts.find((p) => p.text)?.text ?? "Mensagem").split("\n")[0].slice(0, 40) || "Mensagem";
  if (n.type === "wait") return `${n.amount} ${UNIT[n.unit]}`;
  if (n.type === "waitHour") return `Até as ${n.hour}${n.days?.length ? ` · ${n.days.map((d) => DAYS[d]).join(", ")}` : ""}`;
  if (n.type === "waitDate") return n.at ? new Date(`${n.at}:00-03:00`).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Escolha a data";
  if (n.type === "waitUntil") return `Até ${EVENT[n.event]} · prazo ${n.amount} ${UNIT[n.unit]}`;
  if (n.type === "cond") return "Condição";
  if (n.type === "multi") return "Condição múltipla";
  if (n.type === "random") return "Randomizador";
  if (n.type === "tag") return `${n.action === "add" ? "Adicionar" : "Remover"} "${n.tag || "?"}"`;
  if (n.type === "list") return `${n.action === "add" ? "Entrar na" : "Sair da"} lista ${c.lists.get(n.listId) ?? "?"}`;
  if (n.type === "chat") return n.action === "transfer" ? `${CHAT_ACT.transfer} ${n.assignee || "a fila"}` : CHAT_ACT[n.action];
  if (n.type === "goto") return c.autos.get(n.automationId) ?? "Escolha a automação";
  if (n.type === "notify") return n.to ? `Para ${n.to.includes("@g.us") ? "grupo" : n.to}` : "Escolha quem recebe";
  if (n.type === "webhook") return n.url ? n.url.replace(/^https:\/\//, "").slice(0, 34) : "Cole a URL";
  if (n.type === "exit") return "Sair";
  return "Nota";
}
function warning(n: Node, c: Ctx) {
  if (n.type === "send" && !partsFor(n, c).some((p) => p.text || p.mediaUrl || p.productImage)) return n.messageId && !c.tpl.get(n.messageId) ? "A mensagem da biblioteca foi apagada" : "Mensagem vazia";
  if (n.type === "tag" && !n.tag) return "Falta a etiqueta";
  if (n.type === "list" && !n.listId) return "Falta escolher a lista";
  if (n.type === "cond" && (n.rules ?? []).some((r) => CHECKS.find((x) => x.k === r.check)?.needs && !r.value)) return "Regra sem valor";
  if (n.type === "multi" && n.branches.some((b) => b.rules.some((r) => CHECKS.find((x) => x.k === r.check)?.needs && !r.value))) return "Regra sem valor";
  if (n.type === "waitDate" && !n.at) return "Falta a data";
  if (n.type === "goto" && !n.automationId) return "Falta a automação";
  if (n.type === "notify" && (!n.to || !n.text)) return "Falta destino ou texto";
  if (n.type === "webhook" && !n.url) return "Falta a URL";
  return "";
}
function Rich({ text }: { text: string }) {
  return <WaText text={text} />;
}
void VARS;

export function Canvas(props: Props) {
  const router = useRouter();
  const lists = useMemo(() => new Map(props.lists.map((l) => [l.id, l.name])), [props.lists]);
  const [templates, setTemplates] = useState<Tpl[]>(props.templates);
  const cx: Ctx = useMemo(() => ({ lists, tpl: new Map(templates.map((t) => [t.id, t])), autos: new Map(props.automations.map((a) => [a.id, a.name])) }), [lists, templates, props.automations]);
  const [testing, setTesting] = useState(false);
  const runTest = async () => {
    if (dirty) await save();
    setTesting(true);
    const r = await testAutomation(props.id).catch(() => ({ ok: false, error: "Falhou" }));
    setTesting(false);
    setMsg(r.ok ? ("msg" in r ? r.msg ?? "Enviado" : "Enviado") : ("error" in r ? r.error ?? "Falhou" : "Falhou"));
  };
  const [flow, setFlow] = useState<Flow>(() => layout(props.flow));
  const [meta, setMeta] = useState<Meta>(props.meta);
  const [active, setActive] = useState(props.active);
  const [askActive, setAskActive] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [view, setView] = useState({ x: 40, y: 40, z: 0.9 });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState<{ from: string; port: string; to: Pt } | null>(null);
  const [picker, setPicker] = useState<{ from?: string; port?: string; at: Pt; screen: Pt } | null>(null);
  const [pos, setPos] = useState<{ ports: Record<string, Pt>; ins: Record<string, Pt> }>({ ports: {}, ins: {} });
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const vp = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const hist = useRef<Flow[]>([]);
  const op = useRef<null | { kind: "pan" | "node" | "conn"; sx: number; sy: number; ox: number; oy: number; id?: string; port?: string; moved: boolean; snap?: Flow }>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const flowRef = useRef(flow);
  flowRef.current = flow;

  /* ---------- mudanças com desfazer ---------- */
  const commit = useCallback((next: Flow, snap?: Flow) => {
    hist.current.push(snap ?? flowRef.current);
    if (hist.current.length > 60) hist.current.shift();
    setFlow(next);
    setDirty(true);
  }, []);
  const edit = useCallback((fn: (f: Flow) => void) => { const f = clone(flowRef.current); fn(f); commit(f); }, [commit]);
  const undo = useCallback(() => { const prev = hist.current.pop(); if (prev) { setFlow(prev); setDirty(true); } }, []);
  const editNode = useCallback((id: string, fn: (n: Node) => void) => edit((f) => { if (f.nodes[id]) fn(f.nodes[id]); }), [edit]);

  /* ---------- coordenadas ---------- */
  const toCanvas = useCallback((cx: number, cy: number): Pt => {
    const r = vp.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
  }, []);

  // Mede onde ficaram as bolinhas depois de cada desenho
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const z = view.z;
    const ports: Record<string, Pt> = {}, ins: Record<string, Pt> = {};
    el.querySelectorAll<HTMLElement>("[data-port]").forEach((d) => { const r = d.getBoundingClientRect(); ports[d.dataset.port!] = { x: (r.left + r.width / 2 - base.left) / z, y: (r.top + r.height / 2 - base.top) / z }; });
    el.querySelectorAll<HTMLElement>("[data-in]").forEach((d) => { const r = d.getBoundingClientRect(); ins[d.dataset.in!] = { x: (r.left + r.width / 2 - base.left) / z, y: (r.top + r.height / 2 - base.top) / z }; });
    const next = { ports, ins };
    if (JSON.stringify(next) !== JSON.stringify(pos)) setPos(next);
  });

  const fit = useCallback(() => {
    const el = vp.current;
    if (!el) return;
    const pts = [flow.startPos ?? { x: 60, y: 200 }, ...Object.values(flow.nodes).map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 }))];
    const minX = Math.min(...pts.map((p) => p.x)) - 40, minY = Math.min(...pts.map((p) => p.y)) - 40;
    const maxX = Math.max(...pts.map((p) => p.x)) + W + 40, maxY = Math.max(...pts.map((p) => p.y)) + 340;
    const r = el.getBoundingClientRect();
    const z = Math.max(0.3, Math.min(1.1, Math.min(r.width / (maxX - minX), r.height / (maxY - minY))));
    setView({ z, x: (r.width - (maxX - minX) * z) / 2 - minX * z, y: (r.height - (maxY - minY) * z) / 2 - minY * z });
  }, [flow]);
  useEffect(() => { fit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const r = vp.current!.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top;
    setView((v) => { const z = Math.max(0.3, Math.min(1.8, v.z * factor)); return { z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z }; });
  }, []);

  // Roda do mouse aproxima; arrastar com dois dedos no trackpad move a tela
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest(".cv-picker")) return;
      e.preventDefault();
      const mouseWheel = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || e.metaKey || mouseWheel) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [zoomAt]);

  /* ---------- arrastar ---------- */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const o = op.current;
      if (!o) return;
      const dx = e.clientX - o.sx, dy = e.clientY - o.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) o.moved = true;
      if (o.kind === "pan") setView((v) => ({ ...v, x: o.ox + dx, y: o.oy + dy }));
      if (o.kind === "node" && o.moved) {
        const z = viewRef.current.z;
        setFlow((f) => {
          const n = clone(f);
          const x = Math.round((o.ox + dx / z) / 8) * 8, y = Math.round((o.oy + dy / z) / 8) * 8;
          if (o.id === START) n.startPos = { x, y };
          else if (n.nodes[o.id!]) { n.nodes[o.id!].x = x; n.nodes[o.id!].y = y; }
          return n;
        });
      }
      if (o.kind === "conn") setPending({ from: o.id!, port: o.port!, to: toCanvas(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      const o = op.current;
      op.current = null;
      if (!o) return;
      if (o.kind === "node" && o.moved) { hist.current.push(o.snap!); setDirty(true); }
      if (o.kind === "pan" && !o.moved) { setSel(null); setPicker(null); }
      if (o.kind === "conn") {
        setPending(null);
        const hit = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-node]")?.dataset.node;
        if (o.moved && hit && hit !== o.id && hit !== START && flowRef.current.nodes[hit]?.type !== "note") {
          connect(o.id!, o.port!, hit);
        } else if (!hit || hit === o.id) {
          const r = vp.current!.getBoundingClientRect();
          setPicker({ from: o.id, port: o.port, at: toCanvas(e.clientX, e.clientY), screen: { x: e.clientX - r.left, y: e.clientY - r.top } });
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }); // usa a versão mais nova de connect

  const connect = (from: string, port: string, to: string | undefined) => edit((f) => {
    if (from === START) f.start = to;
    else if (f.nodes[from]) (f.nodes[from] as Record<string, unknown>)[port] = to;
  });
  const target = (from: string, port: string): string | undefined => (from === START ? flow.start : ((flow.nodes[from] as Record<string, unknown> | undefined)?.[port] as string | undefined));

  const startPan = (e: RPointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    op.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };
  const startNode = (e: RPointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest("[data-port],button,input,textarea,select")) return;
    e.stopPropagation();
    const p = id === START ? flow.startPos ?? { x: 60, y: 200 } : { x: flow.nodes[id].x ?? 0, y: flow.nodes[id].y ?? 0 };
    op.current = { kind: "node", id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false, snap: flow };
    setSel({ kind: "node", id });
    setPicker(null);
  };
  const startConn = (e: RPointerEvent, id: string, port: string) => {
    e.stopPropagation();
    op.current = { kind: "conn", id, port, sx: e.clientX, sy: e.clientY, ox: 0, oy: 0, moved: false };
    setPicker(null);
  };

  /* ---------- blocos ---------- */
  const addBlock = (type: NodeType, at?: Pt, from?: { id: string; port: string }) => {
    const id = rid();
    const n = newNode(type);
    let p = at;
    if (!p) {
      const r = vp.current!.getBoundingClientRect();
      p = toCanvas(r.left + r.width / 2 - 100, r.top + r.height / 2 - 80);
    }
    n.x = Math.round(p.x / 8) * 8; n.y = Math.round(p.y / 8) * 8;
    edit((f) => {
      f.nodes[id] = n;
      if (from) { if (from.id === START) f.start = id; else if (f.nodes[from.id]) (f.nodes[from.id] as Record<string, unknown>)[from.port] = id; }
      if (!f.start && type !== "note") f.start = id;
    });
    setSel({ kind: "node", id });
    setPicker(null);
  };
  const removeNode = (id: string) => {
    if (id === START) return;
    edit((f) => {
      delete f.nodes[id];
      if (f.start === id) f.start = undefined;
      for (const n of Object.values(f.nodes) as Record<string, unknown>[]) for (const k of Object.keys(n)) if (n[k] === id && k !== "type" && k !== "title") delete n[k];
    });
    setSel(null);
  };
  const duplicate = (id: string) => {
    const src = flow.nodes[id];
    if (!src) return;
    const nid = rid();
    const n = clone(src) as Record<string, unknown>;
    for (const p of portsOf(src)) delete n[p.k];
    n.x = (src.x ?? 0) + 40; n.y = (src.y ?? 0) + 40;
    edit((f) => { f.nodes[nid] = n as Node; });
    setSel({ kind: "node", id: nid });
  };

  /* ---------- salvar ---------- */
  const save = useCallback(async (close = false) => {
    setSaving(true);
    setMsg("");
    try {
      const r = await saveFlowAction(props.id, { flow: flowRef.current, name: meta.name, trigger: meta.trigger, config: meta.config });
      if (r.ok) { setDirty(false); setMsg("Salvo"); if (close) router.push("/automacoes"); else router.refresh(); }
      else setMsg(r.error ?? "Não salvou");
    } catch {
      setMsg("Não salvou, tente de novo");
    }
    setSaving(false);
  }, [meta, props.id, router]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input,textarea,select,[contenteditable]");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); return; }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (sel?.kind === "node") removeNode(sel.id);
        if (sel?.kind === "edge") { connect(sel.from, sel.port, undefined); setSel(null); }
      }
      if (e.key === "Escape") { setSel(null); setPicker(null); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [dirty]);

  const toggleActive = async () => {
    setAskActive(false);
    if (dirty) await save();
    await setAutomationActive(props.id, !active);
    setActive(!active);
    router.refresh();
  };

  /* ---------- desenho ---------- */
  const edges: { key: string; from: string; port: string; d: string; color: string; mid: Pt; label: string; dashed: boolean }[] = [];
  const addEdge = (from: string, p: Port, to?: string) => {
    if (!to) return;
    const a = pos.ports[`${from}:${p.k}`], b = pos.ins[to];
    if (!a || !b) return;
    const bx = b.x - 3;
    const dx = Math.max(50, Math.abs(bx - a.x) / 2);
    const plain = p.k === "next" || p.k === "start";
    edges.push({ key: `${from}:${p.k}`, from, port: p.k, color: plain ? "#6b6b6b" : TONE_COLOR[p.tone], d: `M${a.x},${a.y} C${a.x + dx},${a.y} ${bx - dx},${b.y} ${bx},${b.y}`, mid: { x: (a.x + bx) / 2, y: (a.y + b.y) / 2 }, label: plain ? "" : edgeLabel(p.k, p.label), dashed: true });
  };
  addEdge(START, { k: "start", label: "", tone: "n" }, flow.start);
  for (const [id, n] of Object.entries(flow.nodes)) for (const p of portsOf(n)) addEdge(id, p, (n as Record<string, unknown>)[p.k] as string | undefined);
  let tempPath = "";
  if (pending) {
    const a = pos.ports[`${pending.from}:${pending.port}`];
    if (a) { const b = pending.to, dx = Math.max(50, Math.abs(b.x - a.x) / 2); tempPath = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`; }
  }

  const trig = TRIGGERS.find((t) => t.k === meta.trigger);
  const selNode = sel?.kind === "node" && sel.id !== START ? flow.nodes[sel.id] : null;
  const st = (id: string) => props.stats[id] ?? { sent: 0, clicks: 0, replied: 0 };

  const portRow = (id: string, p: Port, fromStart = false) => (
    <div key={p.k} className="cv-pr">
      <span>{p.label}</span>
      <span className={`cv-port ${target(id, fromStart ? "start" : p.k) ? "on" : ""}`} style={{ "--c": TONE_COLOR[p.tone] } as React.CSSProperties} data-port={`${id}:${p.k}`} onPointerDown={(e) => startConn(e, id, p.k)} title="Arraste até um bloco, ou clique para criar o próximo" />
    </div>
  );

  return (
    <div className="flowed">
      <div className="cv-top">
        <button className="cv-ib" title="Fechar" onClick={() => { if (!dirty || window.confirm("Sair sem salvar as mudanças?")) router.push("/automacoes"); }}><X size={18} /></button>
        <input className="cv-name" value={meta.name} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setDirty(true); }} aria-label="Nome da automação" />
        <span className="cv-stat">{props.totals.entered} entraram · {props.totals.sent} envios · {props.totals.clickPct}% clique · {props.totals.value}</span>
        <div className="cv-acts">
          {msg && !dirty && <span className="cv-msg">{msg}</span>}
          <Link className="btn sm ghost" href={`/automacoes/${props.id}/relatorio`} title="Relatório completo"><BarChart3 size={14} /> Relatório</Link>
          <button className="btn sm ghost" disabled={testing} onClick={runTest} title="Manda as mensagens do caminho principal no grupo de teste"><FlaskConical size={14} /> {testing ? "Enviando…" : "Testar"}</button>
          {dirty && <span className="cv-msg warn">Alterações não salvas</span>}
          <div className="cv-act-wrap">
            <button className={`sw2 ${active ? "on" : ""}`} onClick={() => setAskActive((v) => !v)} aria-label={active ? "Desligar" : "Ligar"} title={active ? "Ligada" : "Desligada"}><i /></button>
            {askActive && (
              <div className="cv-ask">
                <p>{active ? "Desligar esta automação? Quem está no meio para de receber." : "Ligar esta automação? As mensagens começam a sair para quem entrar no gatilho a partir de agora."}</p>
                <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}><button className="btn sm ghost" onClick={() => setAskActive(false)}>Cancelar</button><button className="btn sm pri" onClick={toggleActive}>{active ? "Desligar" : "Ligar"}</button></div>
              </div>
            )}
          </div>
          <button className="btn sm" disabled={saving} onClick={() => save()}>{saving ? "Salvando…" : "Salvar"}</button>
          <button className="btn sm pri" disabled={saving} onClick={() => save(true)}>Salvar e fechar</button>
        </div>
      </div>

      <div className="cv-body">
        <aside className="cv-side">
          {selNode && sel?.kind === "node" ? (
            <NodePanel key={sel.id} id={sel.id} n={selNode} lists={props.lists} extra={{ templates, automations: props.automations.filter((a) => a.id !== props.id), users: props.users, groups: props.groups }} onTemplate={(t) => setTemplates((cur) => [...cur.filter((x) => x.id !== t.id), t])} stats={st(sel.id)} onChange={(fn) => editNode(sel.id, fn)} onClose={() => setSel(null)} onDelete={() => removeNode(sel.id)} onDuplicate={() => duplicate(sel.id)} />
          ) : (
            <div className="cv-panel">
              <div className="cv-ph"><span className="cv-ico sm i-cfg"><Zap size={14} /></span><b>Configurações</b></div>
              <div className="cv-card">
                <b>Gatilho</b><small>O que coloca a pessoa nesta automação</small>
                <select className="in" value={meta.trigger} onChange={(e) => { setMeta({ ...meta, trigger: e.target.value }); setDirty(true); }}>
                  {[...new Set(TRIGGERS.map((t) => t.group))].map((g) => <optgroup key={g} label={g}>{TRIGGERS.filter((t) => t.group === g).map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}</optgroup>)}
                </select>
                <small>{trig?.desc}</small>
                {meta.trigger === "lista" && (
                  <select className="in" value={meta.config.listId ?? ""} onChange={(e) => { setMeta({ ...meta, config: { ...meta.config, listId: e.target.value || undefined } }); setDirty(true); }}>
                    <option value="">Qualquer lista</option>{props.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
                <label className="cv-field">Esperar antes de começar
                  <span className="row" style={{ gap: 6 }}><input className="in" inputMode="numeric" style={{ width: 80 }} value={meta.config.delayMin ?? 0} onChange={(e) => { setMeta({ ...meta, config: { ...meta.config, delayMin: Number(e.target.value.replace(/\D/g, "")) || 0 } }); setDirty(true); }} /> minutos</span>
                </label>
                <label className="cv-tg"><input type="checkbox" checked={!!meta.config.stopOnPaid} onChange={(e) => { setMeta({ ...meta, config: { ...meta.config, stopOnPaid: e.target.checked } }); setDirty(true); }} /><i /> Sair da automação se pagar</label>
              </div>
              <div className="cv-card">
                <b>Adicionar bloco</b><small>Arraste para a tela ou clique</small>
                {[...new Set(BLOCKS.map((b) => b.group))].map((g) => (
                  <div key={g}>
                    <div className="cv-grp">{g}</div>
                    <div className="cv-pal">
                      {BLOCKS.filter((b) => b.group === g).map((b) => (
                        <button key={b.type} draggable onDragStart={(e) => e.dataTransfer.setData("text/block", b.type)} onClick={() => addBlock(b.type)}>
                          <span className={`cv-ico sm i-${b.type}`}>{ICON[b.type]}</span>{b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="cv-card">
                <b>Últimas pessoas</b>
                {props.people.length ? props.people.map((p) => (
                  <div key={p.id} className="row" style={{ justifyContent: "space-between", fontSize: 12.5 }}><span>{p.name}</span><span className={`chip ${p.status === "converteu" ? "c-l" : p.status === "erro" ? "c-c" : p.status === "no meio" ? "c-k" : "c-n"}`}>{p.status}</span></div>
                )) : <small>Ninguém ainda.</small>}
              </div>
              <small className="dim" style={{ padding: "0 4px 12px" }}>Dica: arraste a bolinha de saída de um bloco até outro para ligar. Clique na bolinha para criar o próximo bloco. Delete apaga o que estiver selecionado e Ctrl+Z desfaz.</small>
            </div>
          )}
        </aside>

        <div
          ref={vp}
          className={`cv-vp${op.current?.kind === "pan" ? " grabbing" : ""}`}
          onPointerDown={startPan}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { const t = e.dataTransfer.getData("text/block") as NodeType; if (t) { e.preventDefault(); const p = toCanvas(e.clientX, e.clientY); addBlock(t, { x: p.x - 40, y: p.y - 20 }); } }}
          style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${22 * view.z}px ${22 * view.z}px` }}
        >
          <div ref={inner} className="cv-in" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
            <svg className="cv-svg" width="1" height="1">
              <defs>
                {[...new Set([...edges.map((e) => e.color), "#1a73e8", "#6b6b6b"])].map((c) => (
                  <marker key={c} id={`ar-${c === "#1a73e8" ? "sel" : c.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill={c} /></marker>
                ))}
              </defs>
              {edges.map((e) => {
                const on = (sel?.kind === "edge" && sel.from === e.from && sel.port === e.port) || hoverEdge === e.key;
                return (
                  <g key={e.key}>
                    <path d={e.d} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onPointerDown={(ev) => { ev.stopPropagation(); setSel({ kind: "edge", from: e.from, port: e.port }); }}
                      onPointerEnter={() => setHoverEdge(e.key)} onPointerLeave={() => setHoverEdge(null)} />
                    <path d={e.d} stroke={on ? "#1a73e8" : e.color} strokeWidth={on ? 2.4 : 1.6} strokeDasharray="5 4" fill="none" markerEnd={`url(#ar-${on ? "sel" : e.color.slice(1)})`} />
                  </g>
                );
              })}
              {tempPath && <path d={tempPath} stroke="#60a5fa" strokeWidth={2} fill="none" strokeDasharray="4 4" />}
            </svg>
            {edges.filter((e) => e.label && !(sel?.kind === "edge" && sel.from === e.from && sel.port === e.port)).map((e) => (
              <span key={`l-${e.key}`} className="cv-elab" style={{ left: e.mid.x, top: e.mid.y, background: e.color }}>{e.label}</span>
            ))}
            {edges.filter((e) => sel?.kind === "edge" && sel.from === e.from && sel.port === e.port).map((e) => (
              <button key={e.key} className="cv-edge-x" style={{ left: e.mid.x, top: e.mid.y }} onPointerDown={(ev) => ev.stopPropagation()} onClick={() => { connect(e.from, e.port, undefined); setSel(null); }} title="Remover ligação"><X size={12} /></button>
            ))}

            {/* Gatilho */}
            <div data-node={START} className={`cv-node trig${sel?.kind === "node" && sel.id === START ? " sel" : ""}`} style={{ left: flow.startPos?.x ?? 60, top: flow.startPos?.y ?? 200, width: 220 }} onPointerDown={(e) => startNode(e, START)}>
              <div className="cv-h"><span className="cv-ico i-trig"><Zap size={15} /></span><div><b>{trig?.label ?? meta.trigger}</b></div></div>
              <div className="cv-big"><b>{props.totals.entered.toLocaleString("pt-BR")}</b><span>Execuções</span></div>
              {portRow(START, { k: "start", label: "Próxima etapa", tone: "n" }, true)}
            </div>

            {Object.entries(flow.nodes).map(([id, n]) => {
              const m = blockMeta(n.type);
              const w = warning(n, cx);
              const isSel = sel?.kind === "node" && sel.id === id;
              if (n.type === "note")
                return (
                  <div key={id} data-node={id} className={`cv-note${isSel ? " sel" : ""}`} style={{ left: n.x, top: n.y, background: n.color || undefined }} onPointerDown={(e) => startNode(e, id)}>
                    {n.text || "Escreva uma nota…"}
                  </div>
                );
              const s = st(id);
              return (
                <div key={id} data-node={id} className={`cv-node k-${n.type}${isSel ? " sel" : ""}${w ? " warnb" : ""}${flow.start === id ? " first" : ""}`} style={{ left: n.x, top: n.y, width: n.type === "send" ? W : n.type === "cond" || n.type === "multi" ? 250 : n.type === "wait" || n.type === "waitHour" || n.type === "waitDate" || n.type === "exit" || n.type === "tag" ? 180 : 220 }} onPointerDown={(e) => startNode(e, id)}>
                  {w && <span className="cv-warn" title={w}><AlertTriangle size={13} /></span>}
                  {isSel && (
                    <div className="cv-tools">
                      <button title="Editar" className="ed" onClick={() => document.querySelector(".cv-side")?.scrollTo({ top: 0, behavior: "smooth" })}><Pencil size={12} /></button>
                      <button title="Duplicar" className="dup" onClick={() => duplicate(id)}><Copy size={12} /></button>
                      <button title="Apagar" className="del" onClick={() => removeNode(id)}><Trash2 size={12} /></button>
                    </div>
                  )}
                  <span className="cv-dot-in" data-in={id} />
                  <div className="cv-h"><span className={`cv-ico i-${n.type}`}>{ICON[n.type]}</span><div>{!HIDE_KIND.has(n.type) && <small>{m.label}</small>}<b>{title(n, cx)}</b>{n.type === "send" && n.messageId && cx.tpl.get(n.messageId) && <span className="cv-okchip" title={cx.tpl.get(n.messageId)?.folder}><Library size={10} /> Da biblioteca</span>}</div></div>
                  {n.type === "send" && (
                    <>
                      <div className="cv-k"><div><b>{s.sent.toLocaleString("pt-BR")}</b><span>Envios</span></div><div><b>{s.sent ? Math.min(100, Math.round((s.clicks / s.sent) * 100)) : 0}%</b><span>Clique</span></div><div><b>{s.replied.toLocaleString("pt-BR")}</b><span>Respostas</span></div></div>
                      <div className="cv-mini">
                        {partsFor(n, cx).slice(0, 3).map((p, i) => (
                          <div key={i} className="cv-bb">
                            {(p.productImage || p.mediaUrl) && <div className="cv-img">{p.mediaType === "image" && p.mediaUrl ? <img src={(p.mediaUrl ?? "").replace(/^https?:\/\/[^/]+/, "")} alt="" /> : p.productImage ? <><ImageIcon size={14} /> foto do produto</> : <><Paperclip size={13} /> arquivo</>}</div>}
                            {p.text ? <Rich text={p.text.length > 160 ? `${p.text.slice(0, 160)}…` : p.text} /> : !(p.productImage || p.mediaUrl) ? <span className="dim">Vazia</span> : null}
                          </div>
                        ))}
                        {partsFor(n, cx).length > 3 && <small className="dim">+{partsFor(n, cx).length - 3} partes</small>}
                      </div>
                    </>
                  )}
                  {n.type === "multi" && (
                    <div className="cv-rbox">{n.branches.map((b, i) => <div key={i}>{i > 0 && <em>ou</em>}<p><span className="cv-letter">{"ABCDEFGHIJ"[i]}</span>{ruleText(b.rules, b.mode, cx) || "sem regra"}</p></div>)}</div>
                  )}
                  {n.type === "random" && <div className="cv-rbox"><div><p><span className="cv-letter">A</span>{n.pct}% das pessoas</p></div><div><em>ou</em><p><span className="cv-letter">B</span>{100 - n.pct}% das pessoas</p></div></div>}
                  {n.type === "chat" && n.action === "note" && n.text && <div className="cv-rules">{n.text.slice(0, 90)}</div>}
                  {n.type === "notify" && n.text && <div className="cv-rules">{n.text.slice(0, 90)}</div>}
                  {n.type === "cond" && (
                    <div className="cv-rbox">{(n.rules?.length ? n.rules : [{ check: n.check }]).map((r, i) => <div key={i}>{i > 0 && <em>{n.mode === "any" ? "ou" : "e"}</em>}<p><b>{CHECKS.find((c) => c.k === r.check)?.label ?? r.check}</b>{r.value ? <><i> {r.check === "valor_min" ? "maior ou igual" : r.check === "valor_max" ? "menor ou igual" : "igual"} </i><b>{r.check === "lista" ? lists.get(r.value) ?? "" : r.value}</b></> : null}</p></div>)}</div>
                  )}
                  {portsOf(n).map((p) => portRow(id, p))}
                </div>
              );
            })}
          </div>

          {!Object.keys(flow.nodes).length && <div className="cv-empty">Arraste um bloco da esquerda para cá, ou clique na bolinha do gatilho.</div>}

          {picker && (
            <div className="cv-picker" style={{ left: Math.min(picker.screen.x, (vp.current?.clientWidth ?? 800) - 230), top: Math.min(picker.screen.y, (vp.current?.clientHeight ?? 600) - 330) }} onPointerDown={(e) => e.stopPropagation()}>
              <div className="row" style={{ justifyContent: "space-between", padding: "2px 4px 6px" }}><b style={{ fontSize: 12.5 }}>Próximo bloco</b><button className="cv-ib sm" onClick={() => setPicker(null)}><X size={14} /></button></div>
              {picker.from && target(picker.from, picker.from === START ? "start" : picker.port!) && (
                <button className="cv-pick-del" onClick={() => { connect(picker.from!, picker.port!, undefined); setPicker(null); }}>Remover ligação atual</button>
              )}
              {BLOCKS.filter((b) => b.type !== "note").map((b) => (
                <button key={b.type} onClick={() => addBlock(b.type, { x: picker.at.x + 70, y: picker.at.y - 30 }, picker.from ? { id: picker.from, port: picker.from === START ? "start" : picker.port! } : undefined)}>
                  <span className={`cv-ico sm i-${b.type}`}>{ICON[b.type]}</span>{b.label}
                </button>
              ))}
            </div>
          )}

          <div className="cv-zoom" onPointerDown={(e) => e.stopPropagation()}>
            <button title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!hist.current.length}><Undo2 size={15} /></button>
            <button title="Afastar" onClick={() => zoomAt(1 / 1.2)}><Minus size={15} /></button>
            <span>{Math.round(view.z * 100)}%</span>
            <button title="Aproximar" onClick={() => zoomAt(1.2)}><Plus size={15} /></button>
            <button title="Ver tudo" onClick={fit}><Maximize2 size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Painel do bloco aberto ---------- */

function RulesEditor({ rules, mode, lists, onRules, onMode }: { rules: Rule[]; mode?: "all" | "any"; lists: Opt[]; onRules: (fn: (r: Rule[]) => void) => void; onMode: (m: "all" | "any") => void }) {
  return (
    <>
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        <button className={mode !== "any" ? "on" : ""} onClick={() => onMode("all")}>Todas as regras</button>
        <button className={mode === "any" ? "on" : ""} onClick={() => onMode("any")}>Qualquer regra</button>
      </div>
      {rules.map((r, i) => {
        const c = CHECKS.find((x) => x.k === r.check);
        const set = (fn: (rr: Rule) => void) => onRules((rs) => fn(rs[i]));
        return (
          <div key={i} className="cv-rule">
            {i > 0 && <span className="cv-or">{mode === "any" ? "ou" : "e"}</span>}
            <div className="row" style={{ gap: 6 }}>
              <select className="in" value={r.check} onChange={(e) => set((rr) => { rr.check = e.target.value; rr.value = undefined; })}>{CHECKS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
              {rules.length > 1 && <button className="cv-ib sm" title="Tirar regra" onClick={() => onRules((rs) => { rs.splice(i, 1); })}><X size={14} /></button>}
            </div>
            {c?.needs === "list" && <select className="in" value={r.value ?? ""} onChange={(e) => set((rr) => { rr.value = e.target.value || undefined; })}><option value="">Escolha a lista</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
            {c?.needs === "text" && <input className="in" value={r.value ?? ""} placeholder={r.check === "etiqueta" ? "Ex.: carrinho frio" : r.check === "pagamento" ? "Ex.: pix" : r.check === "status_entrega" ? "Ex.: saiu" : r.check === "hora_entre" ? "Ex.: 8-20" : r.check === "dia_semana" ? "Ex.: 1-5" : "Ex.: kimono"} onChange={(e) => set((rr) => { rr.value = e.target.value || undefined; })} />}
            {c?.needs === "number" && <input className="in" inputMode="decimal" value={r.value ?? ""} placeholder="Ex.: 300" onChange={(e) => set((rr) => { rr.value = e.target.value || undefined; })} />}
          </div>
        );
      })}
      <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => onRules((rs) => { rs.push({ check: "clicou" }); })}><Plus size={14} /> Adicionar regra</button>
      <small className="cv-sum">Quem passa: {rules.map((r) => `${CHECKS.find((x) => x.k === r.check)?.label.toLowerCase() ?? r.check}${r.value ? ` ${r.check === "lista" ? lists.find((l) => l.id === r.value)?.name ?? "" : r.value}` : ""}`).join(mode === "any" ? " ou " : " e ")}</small>
    </>
  );
}

function NodePanel({ id, n, lists, extra, onTemplate, stats, onChange, onClose, onDelete, onDuplicate }: {
  id: string; n: Node; lists: Opt[]; extra: Extra; onTemplate: (t: Tpl) => void; stats: { sent: number; clicks: number; replied: number };
  onChange: (fn: (n: Node) => void) => void; onClose: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const m = blockMeta(n.type);
  void id;
  return (
    <div className="cv-panel">
      <div className="cv-ph"><span className={`cv-ico sm i-${n.type}`}>{ICON[n.type]}</span><b>{m.label}</b><button className="cv-ib sm" style={{ marginLeft: "auto" }} onClick={onClose} title="Fechar"><X size={15} /></button></div>
      {n.type !== "note" && (
        <div className="cv-card">
          <label className="cv-field">Nome do bloco (opcional)<input className="in" value={n.title ?? ""} placeholder="Ex.: Lembrete com cupom" onChange={(e) => onChange((x) => { x.title = e.target.value || undefined; })} /></label>
        </div>
      )}
      {n.type === "send" && <SendForm n={n} onChange={onChange} stats={stats} extra={extra} onTemplate={onTemplate} />}
      {n.type === "wait" && (
        <div className="cv-card">
          <b>Aguardar</b><small>Quanto tempo esperar antes de seguir</small>
          <div className="row" style={{ gap: 8 }}>
            <input className="in" inputMode="numeric" style={{ width: 90 }} value={n.amount} onChange={(e) => onChange((x) => { if (x.type === "wait") x.amount = Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1); })} />
            <select className="in" value={n.unit} onChange={(e) => onChange((x) => { if (x.type === "wait") x.unit = e.target.value as "min" | "h" | "d"; })}>{Object.entries(UNIT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
        </div>
      )}
      {n.type === "waitHour" && (
        <div className="cv-card">
          <b>Aguardar horário</b><small>Segue no próximo horário escolhido (horário de Brasília)</small>
          <input className="in" type="time" value={n.hour} onChange={(e) => onChange((x) => { if (x.type === "waitHour") x.hour = e.target.value || "10:00"; })} />
          <small>Só nestes dias (nenhum marcado = qualquer dia)</small>
          <div className="cv-days">{DAYS.map((d, i) => <button key={d} className={n.days?.includes(i) ? "on" : ""} onClick={() => onChange((x) => { if (x.type === "waitHour") { const s = new Set(x.days ?? []); if (s.has(i)) s.delete(i); else s.add(i); x.days = [...s].sort(); } })}>{d}</button>)}</div>
        </div>
      )}
      {n.type === "cond" && (
        <div className="cv-card">
          <b>Condição</b><small>Quem atender segue pela saída verde, o resto pela vermelha</small>
          <RulesEditor rules={n.rules?.length ? n.rules : [{ check: n.check, value: n.value }]} mode={n.mode} lists={lists}
            onMode={(m) => onChange((x) => { if (x.type === "cond") x.mode = m; })}
            onRules={(fn) => onChange((x) => { if (x.type === "cond") { x.rules = x.rules?.length ? x.rules : [{ check: x.check, value: x.value }]; fn(x.rules); if (!x.rules.length) x.rules.push({ check: "pagou" }); x.check = x.rules[0].check; } })} />
          <small>&quot;Pagou&quot; vira sim quando a pessoa tem um pedido pago depois de receber a mensagem.</small>
        </div>
      )}
      {n.type === "multi" && (
        <div className="cv-card">
          <b>Condição múltipla</b><small>A pessoa sai pelo primeiro caminho que atender (A, depois B…). Quem não atende nenhum sai pela saída vermelha.</small>
          {n.branches.map((b: Branch, i) => (
            <div key={i} className="cv-branch">
              <div className="row" style={{ gap: 6 }}>
                <span className="cv-letter">{"ABCDEFGHIJ"[i]}</span>
                <input className="in" value={b.label ?? ""} placeholder="Nome do caminho (opcional)" onChange={(e) => onChange((x) => { if (x.type === "multi") x.branches[i].label = e.target.value || undefined; })} />
                <button className="cv-ib sm" title="Duplicar caminho" disabled={n.branches.length >= 10} onClick={() => onChange((x) => { if (x.type === "multi") x.branches.splice(i + 1, 0, structuredClone(x.branches[i])); })}><Copy size={13} /></button>
                {n.branches.length > 1 && <button className="cv-ib sm" title="Tirar caminho" onClick={() => onChange((x) => { if (x.type === "multi") { x.branches.splice(i, 1); const r = x as Record<string, unknown>; for (let k = i; k < 10; k++) r[`m${k}`] = r[`m${k + 1}`]; } })}><X size={14} /></button>}
              </div>
              <RulesEditor rules={b.rules} mode={b.mode} lists={lists}
                onMode={(m) => onChange((x) => { if (x.type === "multi") x.branches[i].mode = m; })}
                onRules={(fn) => onChange((x) => { if (x.type === "multi") { fn(x.branches[i].rules); if (!x.branches[i].rules.length) x.branches[i].rules.push({ check: "pagou" }); } })} />
            </div>
          ))}
          {n.branches.length < 10 && <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange((x) => { if (x.type === "multi") x.branches.push({ rules: [{ check: "produto" }] }); })}><Plus size={14} /> Adicionar caminho</button>}
        </div>
      )}
      {n.type === "random" && (
        <div className="cv-card">
          <b>Randomizador</b><small>Divide as pessoas entre dois caminhos, bom para testar duas mensagens</small>
          <input type="range" min={5} max={95} step={5} value={n.pct} onChange={(e) => onChange((x) => { if (x.type === "random") x.pct = Number(e.target.value); })} />
          <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}><span>Caminho A: <b>{n.pct}%</b></span><span>Caminho B: <b>{100 - n.pct}%</b></span></div>
        </div>
      )}
      {n.type === "tag" && (
        <div className="cv-card">
          <b>Etiqueta</b>
          <select className="in" value={n.action} onChange={(e) => onChange((x) => { if (x.type === "tag") x.action = e.target.value as "add" | "remove"; })}><option value="add">Adicionar etiqueta</option><option value="remove">Remover etiqueta</option></select>
          <input className="in" value={n.tag} placeholder="Ex.: carrinho frio" onChange={(e) => onChange((x) => { if (x.type === "tag") x.tag = e.target.value.toLowerCase(); })} />
        </div>
      )}
      {n.type === "list" && (
        <div className="cv-card">
          <b>Lista</b>
          <select className="in" value={n.action} onChange={(e) => onChange((x) => { if (x.type === "list") x.action = e.target.value as "add" | "remove"; })}><option value="add">Adicionar à lista</option><option value="remove">Remover da lista</option></select>
          <select className="in" value={n.listId} onChange={(e) => onChange((x) => { if (x.type === "list") x.listId = e.target.value; })}><option value="">Escolha a lista</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          {!lists.length && <small>Crie uma lista em Listas primeiro.</small>}
        </div>
      )}
      {n.type === "waitDate" && (
        <div className="cv-card">
          <b>Aguardar data e hora</b><small>Segura a pessoa até o dia e a hora marcados (horário de Brasília). Se a data já passou, segue direto.</small>
          <input className="in" type="datetime-local" value={n.at} onChange={(e) => onChange((x) => { if (x.type === "waitDate") x.at = e.target.value; })} />
        </div>
      )}
      {n.type === "waitUntil" && (
        <div className="cv-card">
          <b>Aguardar acontecer</b><small>Fica parado aqui até a pessoa fazer a ação ou até acabar o prazo. Sai pela verde se aconteceu e pela vermelha se não.</small>
          <div className="seg" style={{ alignSelf: "flex-start" }}>
            {(["pagou", "respondeu", "clicou"] as const).map((k) => <button key={k} className={n.event === k ? "on" : ""} onClick={() => onChange((x) => { if (x.type === "waitUntil") x.event = k; })}>{k === "pagou" ? "Pagar" : k === "respondeu" ? "Responder" : "Clicar"}</button>)}
          </div>
          <label className="cv-field">Prazo
            <span className="row" style={{ gap: 8 }}>
              <input className="in" inputMode="numeric" style={{ width: 90 }} value={n.amount} onChange={(e) => onChange((x) => { if (x.type === "waitUntil") x.amount = Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1); })} />
              <select className="in" value={n.unit} onChange={(e) => onChange((x) => { if (x.type === "waitUntil") x.unit = e.target.value as "min" | "h" | "d"; })}>{Object.entries(UNIT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </span>
          </label>
        </div>
      )}
      {n.type === "chat" && (
        <div className="cv-card">
          <b>Atendimento</b><small>Mexe na conversa dessa pessoa na tela de Atendimento</small>
          <select className="in" value={n.action} onChange={(e) => onChange((x) => { if (x.type === "chat") x.action = e.target.value as typeof x.action; })}>{Object.entries(CHAT_ACT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          {n.action === "transfer" && <select className="in" value={n.assignee ?? ""} onChange={(e) => onChange((x) => { if (x.type === "chat") x.assignee = e.target.value; })}><option value="">Fila (quem pegar primeiro)</option>{extra.users.map((u) => <option key={u} value={u}>{u}</option>)}</select>}
          {n.action === "note" && <textarea className="in" rows={4} value={n.text ?? ""} placeholder="Ex.: Cliente recebeu o lembrete do Pix 2x" onChange={(e) => onChange((x) => { if (x.type === "chat") x.text = e.target.value; })} />}
          {n.action === "ai_on" && <small>O robô de IA passa a responder essa pessoa no privado.</small>}
        </div>
      )}
      {n.type === "goto" && (
        <div className="cv-card">
          <b>Outra automação</b><small>Coloca a pessoa em outra automação (mesmo que ela não tenha o gatilho dela) e segue aqui.</small>
          <select className="in" value={n.automationId} onChange={(e) => onChange((x) => { if (x.type === "goto") x.automationId = e.target.value; })}><option value="">Escolha a automação</option>{extra.automations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </div>
      )}
      {n.type === "notify" && (
        <div className="cv-card">
          <b>Avisar a equipe</b><small>Manda um aviso interno (não vai para o cliente). Use variáveis para saber quem é.</small>
          <select className="in" value={extra.groups.some((g) => g.id === n.to) ? n.to : n.to ? "_num" : ""} onChange={(e) => onChange((x) => { if (x.type === "notify") x.to = e.target.value === "_num" ? "" : e.target.value; })}>
            <option value="">Escolha um grupo ou número</option>
            {extra.groups.map((g) => <option key={g.id} value={g.id}>Grupo: {g.name}</option>)}
            <option value="_num">Um número de WhatsApp</option>
          </select>
          {!extra.groups.some((g) => g.id === n.to) && <input className="in" inputMode="tel" value={n.to} placeholder="(21) 99999-9999" onChange={(e) => onChange((x) => { if (x.type === "notify") x.to = e.target.value; })} />}
          <textarea className="in" rows={4} value={n.text} onChange={(e) => onChange((x) => { if (x.type === "notify") x.text = e.target.value; })} />
          <small>Campos: {"{nome}"} {"{telefone}"} {"{pedido}"} {"{valor}"} {"{produtos}"}</small>
        </div>
      )}
      {n.type === "webhook" && (
        <div className="cv-card">
          <b>Webhook</b><small>Manda um POST com o telefone, nome e dados do pedido para a URL (planilha, Zapier, Make, outro sistema).</small>
          <input className="in" value={n.url} placeholder="https://…" onChange={(e) => onChange((x) => { if (x.type === "webhook") x.url = e.target.value.trim(); })} />
          {n.url && !/^https:\/\//.test(n.url) && <small style={{ color: "var(--coral)" }}>Precisa começar com https://</small>}
        </div>
      )}
      {n.type === "exit" && <div className="cv-card"><b>Sair</b><small>A pessoa sai da automação aqui.</small></div>}
      {n.type === "note" && (
        <div className="cv-card">
          <b>Nota</b><small>Só para você se organizar, não envia nada</small>
          <textarea className="in" rows={5} value={n.text} onChange={(e) => onChange((x) => { if (x.type === "note") x.text = e.target.value; })} />
          <div className="cv-days">{["#3a3416", "#16263a", "#1d3324", "#3a1d1d"].map((c) => <button key={c} style={{ background: c, width: 30 }} className={n.color === c ? "on" : ""} onClick={() => onChange((x) => { if (x.type === "note") x.color = c; })} aria-label="Cor" />)}</div>
        </div>
      )}
      <div className="row" style={{ gap: 8, padding: "0 4px 14px" }}>
        <button className="btn sm" onClick={onDuplicate}><Copy size={14} /> Duplicar</button>
        <button className="btn sm ghost danger" onClick={onDelete}><Trash2 size={14} /> Apagar bloco</button>
      </div>
    </div>
  );
}

function SendForm({ n, onChange, stats, extra, onTemplate }: { n: Extract<Node, { type: "send" }>; onChange: (fn: (n: Node) => void) => void; stats: { sent: number; clicks: number; replied: number }; extra: Extra; onTemplate: (t: Tpl) => void }) {
  const [mode, setMode] = useState<"lib" | "here">(n.messageId || !n.parts.some((p) => p.text || p.mediaUrl || p.productImage) ? "lib" : "here");
  const [modal, setModal] = useState<TemplateData | null>(null);
  const tpl = n.messageId ? extra.templates.find((t) => t.id === n.messageId) : undefined;
  const folders = [...new Set(extra.templates.map((t) => t.folder).filter(Boolean))].sort();
  const byFolder = [...new Set(extra.templates.map((t) => t.folder))].sort().map((f) => ({ f, items: extra.templates.filter((t) => t.folder === f).sort((a, b) => a.name.localeCompare(b.name)) }));
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  const [up, setUp] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const setPart = (i: number, fn: (p: Part) => void) => onChange((x) => { if (x.type === "send") fn(x.parts[i]); });
  const insertVar = (v: string) => {
    const i = Math.min(focus, n.parts.length - 1);
    const el = refs.current[i];
    const text = n.parts[i]?.text ?? "";
    const at = el ? el.selectionStart ?? text.length : text.length;
    setPart(i, (p) => { p.text = text.slice(0, at) + v + text.slice(at); });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + v.length, at + v.length); });
  };
  const upload = async (i: number, file: File) => {
    setUp(i); setErr("");
    const f = new FormData();
    f.set("file", file);
    const r = await uploadPartMedia(f).catch(() => ({ ok: false as const, error: "Falhou o envio" }));
    if (r.ok) setPart(i, (p) => { p.mediaUrl = r.url; p.mediaType = r.type; p.productImage = undefined; });
    else setErr(("error" in r && r.error) || "Não subiu o arquivo");
    setUp(null);
  };
  const ti = Math.max(0, TIMEOUTS.findIndex((t) => t >= (n.timeout ?? 60)));
  return (
    <>
      <div className="cv-card">
        <b>Mensagem</b>
        <div className="seg" style={{ alignSelf: "flex-start" }}>
          <button className={mode === "lib" ? "on" : ""} onClick={() => setMode("lib")}><Library size={13} /> Da biblioteca</button>
          <button className={mode === "here" ? "on" : ""} onClick={() => setMode("here")}><Pencil size={13} /> Escrever aqui</button>
        </div>
        {mode === "lib" ? (
          <>
            <select className="in" value={n.messageId ?? ""} onChange={(e) => onChange((x) => { if (x.type === "send") x.messageId = e.target.value || undefined; })}>
              <option value="">Escolha uma mensagem</option>
              {byFolder.map((g) => <optgroup key={g.f || "_"} label={g.f || "Sem pasta"}>{g.items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
            </select>
            {tpl ? (
              <div className="cv-mini">{tpl.parts.slice(0, 4).map((p, i) => <div key={i} className="cv-bb">{(p.productImage || p.mediaUrl) && <div className="cv-img">{p.productImage ? <><ImageIcon size={13} /> foto do produto</> : <><Paperclip size={12} /> {p.mediaType === "audio" ? "voz" : p.fileName ?? "arquivo"}</>}</div>}{p.text && <Rich text={p.text} />}</div>)}</div>
            ) : n.messageId ? <small style={{ color: "var(--coral)" }}>Essa mensagem foi apagada da biblioteca. Escolha outra.</small> : null}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {tpl && <button className="btn sm" onClick={() => setModal({ id: tpl.id, name: tpl.name, folder: tpl.folder, kind: tpl.kind, parts: tpl.parts })}><Pencil size={13} /> Editar mensagem</button>}
              <button className="btn sm" onClick={() => setModal({ name: "", folder: folders[0] ?? "", kind: "nenhum", parts: [{ text: "" }] })}><Plus size={13} /> Nova mensagem</button>
            </div>
            <small>Editar aqui muda a mensagem em todo lugar que ela é usada.</small>
          </>
        ) : (
          <>
            <small>Cada parte sai como uma mensagem separada, na ordem. Essa mensagem fica só neste bloco.</small>
      <>
          {n.parts.map((p, i) => (
            <div key={i} className="cv-part">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b style={{ fontSize: 12 }}>Parte {i + 1}</b>
                <span className="row" style={{ gap: 2 }}>
                  <button className="cv-ib sm" disabled={i === 0} title="Subir" onClick={() => onChange((x) => { if (x.type === "send") [x.parts[i - 1], x.parts[i]] = [x.parts[i], x.parts[i - 1]]; })}><ChevronUp size={14} /></button>
                  <button className="cv-ib sm" disabled={i === n.parts.length - 1} title="Descer" onClick={() => onChange((x) => { if (x.type === "send") [x.parts[i + 1], x.parts[i]] = [x.parts[i], x.parts[i + 1]]; })}><ChevronDown size={14} /></button>
                  {n.parts.length > 1 && <button className="cv-ib sm" title="Tirar parte" onClick={() => onChange((x) => { if (x.type === "send") x.parts.splice(i, 1); })}><X size={14} /></button>}
                </span>
              </div>
              {(p.mediaUrl || p.productImage) && (
                <div className="cv-att">
                  {p.productImage ? <><ImageIcon size={14} /> Foto do 1º produto</> : p.mediaType === "image" ? <img src={(p.mediaUrl ?? "").replace(/^https?:\/\/[^/]+/, "")} alt="" /> : <><Paperclip size={14} /> {p.mediaType === "video" ? "Vídeo" : "Arquivo"}</>}
                  <button className="cv-ib sm" style={{ marginLeft: "auto" }} onClick={() => setPart(i, (q) => { q.mediaUrl = undefined; q.mediaType = undefined; q.productImage = undefined; })} title="Tirar"><X size={13} /></button>
                </div>
              )}
              <textarea ref={(el) => { refs.current[i] = el; }} className="in" rows={i === 0 ? 5 : 3} value={p.text ?? ""} placeholder={p.mediaUrl || p.productImage ? "Legenda (opcional)" : "Texto ou link"} onFocus={() => setFocus(i)} onChange={(e) => setPart(i, (q) => { q.text = e.target.value || undefined; })} />
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <button className="cv-chip" onClick={() => setPart(i, (q) => { q.productImage = !q.productImage || undefined; if (q.productImage) { q.mediaUrl = undefined; q.mediaType = undefined; } })}><ImageIcon size={12} /> {p.productImage ? "Tirar foto do produto" : "Foto do produto"}</button>
                <label className="cv-chip"><Paperclip size={12} /> {up === i ? "Subindo…" : "Foto, vídeo ou PDF"}<input type="file" hidden accept="image/*,video/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(i, f); e.target.value = ""; }} /></label>
              </div>
            </div>
          ))}
          {err && <div className="err" style={{ fontSize: 12 }}>{err}</div>}
          {n.parts.length < 8 && <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => { onChange((x) => { if (x.type === "send") x.parts.push({ text: "" }); }); setFocus(n.parts.length); }}><Plus size={14} /> Adicionar parte</button>}
          <small>Inserir campo na parte {Math.min(focus, n.parts.length - 1) + 1}:</small>
          <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>{VARS.map((v) => <button key={v.k} className="cv-var btn-var" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVar(v.k)}>{v.label}</button>)}</div>
          <small>Em listas, use o nome da coluna da planilha, ex.: {"{link}"}. Os links contam clique sozinhos.</small>
          <label className="cv-field">Intervalo de digitação <span className="row" style={{ gap: 8 }}><input type="range" min={0} max={30} value={n.typing ?? 5} onChange={(e) => onChange((x) => { if (x.type === "send") x.typing = Number(e.target.value); })} style={{ flex: 1 }} /><b style={{ width: 44, textAlign: "right" }}>{n.typing ?? 5} seg</b></span></label>
        </>
  
  
            <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setModal({ name: n.title || "Mensagem da automação", folder: folders[0] ?? "", kind: "nenhum", parts: n.parts })}><Library size={13} /> Salvar na biblioteca</button>
          </>
        )}
      </div>
      {modal && (
        <div className="cv-modal" onPointerDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="cv-modal-in">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}><b>{modal.id ? "Editar mensagem" : "Nova mensagem"}</b><button className="cv-ib" onClick={() => setModal(null)}><X size={16} /></button></div>
            <MessageEditor compact initial={modal} folders={folders} onSaved={(t) => { onTemplate({ id: t.id, name: t.name, folder: t.folder, kind: t.kind, parts: t.parts }); onChange((x) => { if (x.type === "send") { x.messageId = t.id; x.parts = [{ text: "" }]; } }); setMode("lib"); }} />
          </div>
        </div>
      )}

      <div className="cv-card">
        <b>Resposta da pessoa</b><small>Vale quando você liga as saídas &quot;Se responder&quot;, &quot;Se clicar&quot; ou &quot;Se não responder&quot;</small>
        <label className="cv-field">Tempo limite para responder <span className="row" style={{ gap: 8 }}><input type="range" min={0} max={TIMEOUTS.length - 1} value={ti} onChange={(e) => onChange((x) => { if (x.type === "send") x.timeout = TIMEOUTS[Number(e.target.value)]; })} style={{ flex: 1 }} /><b style={{ width: 54, textAlign: "right" }}>{fmtMin(TIMEOUTS[ti])}</b></span></label>
        <small>Passou o tempo sem resposta nem clique, segue por &quot;Se não responder&quot; (ou &quot;Próxima etapa&quot; se ela estiver solta). Sem essas saídas ligadas, segue direto para a próxima etapa.</small>
      </div>

      <div className="cv-card">
        <b>Parâmetros de UTM</b><small>Entram nos links desta mensagem</small>
        {(["source", "medium", "campaign"] as const).map((k) => (
          <label key={k} className="cv-field">utm_{k}<input className="in" value={n.utm?.[k] ?? ""} placeholder={k === "source" ? "whatsapp" : k === "medium" ? "automacao" : "carrinho"} onChange={(e) => onChange((x) => { if (x.type === "send") x.utm = { ...x.utm, [k]: e.target.value || undefined }; })} /></label>
        ))}
      </div>

      <div className="cv-card">
        <b>Prévia</b>
        <PhonePreview parts={mode === "lib" ? tpl?.parts ?? [] : n.parts} sample={false} />
        {stats.sent > 0 && <small>{stats.sent} envios · {stats.clicks} cliques · {stats.replied} respostas</small>}
      </div>
    </>
  );
}
