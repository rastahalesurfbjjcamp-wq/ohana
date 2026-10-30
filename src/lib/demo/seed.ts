// Popula o banco da demonstração com a loja fictícia. Roda ao subir e de novo toda madrugada.
import bcrypt from "bcryptjs";
import { db } from "../db";
import { ATHLETES, CLUB_CODE_FOR, CUSTOMERS, PRODUCTS } from "./data";

export const DEMO_EMAIL = "visitante@mare-alta.demo";
const day = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ago = (d: number, h = 0) => new Date(Date.now() - d * 864e5 - h * 3600_000);

let running: Promise<void> | null = null;
export async function ensureDemoSeed(force = false) {
  if (running) return running;
  running = (async () => {
    const mark = await db.setting.findUnique({ where: { key: "_demo_seed" } }).catch(() => null);
    if (!force && (mark?.value as { day?: string } | undefined)?.day === day()) return;
    await seed();
    await db.setting.upsert({ where: { key: "_demo_seed" }, create: { key: "_demo_seed", value: { day: day() } }, update: { value: { day: day() } } });
  })().finally(() => { running = null; });
  return running;
}

async function seed() {
  const r = rng(Number(day().replace(/-/g, "")));
  // limpa tudo
  for (const m of ["pollVote", "poll", "broadcastRecipient", "broadcast", "chatMessage", "chatThread", "memberEvent", "membership", "contact", "group", "lead", "recoveryCase", "task", "scheduledMessage", "cost", "payout", "referral", "clubPoints", "clubReward", "clubEvent", "clubCheckout", "clubMember", "clubPrize", "launch", "funnelRun", "funnel", "waitlist", "optOut", "commandLog", "diagnosis", "setting", "user"] as const) {
    await (db[m] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
  await db.user.create({ data: { name: "Visitante", email: DEMO_EMAIL, passwordHash: await bcrypt.hash(String(Math.random()), 8), role: "ADMIN" } });
  const S = (key: string, value: object) => db.setting.create({ data: { key, value } });
  await S("_partners_seeded", { done: true });
  await S("_whatsapp", { state: "open", at: new Date().toISOString() });
  await S("_int_status", { shopify: { ok: true, msg: "Conectado à loja Maré Alta", at: new Date().toISOString() }, meta: { ok: true, msg: "Conectado à conta Maré Alta · Vendas", at: new Date().toISOString() }, appmax: { ok: true, msg: "Conectado (produção)", at: new Date().toISOString() } });
  await S("club", { name: "Clube Maré Alta", autoDiscountId: "gid://shopify/DiscountAutomaticNode/1", segmentId: "gid://shopify/Segment/1" });
  await S("ads", { accounts: [{ id: "1001", name: "Maré Alta · Vendas", on: true, kind: "auto" }, { id: "1002", name: "Maré Alta · Perfil", on: true, kind: "perfil" }], perfilCoupons: ["BEMVINDOIG"] });
  await S("postsale", { storeUrl: "https://mare-alta.exemplo.com" });

  // grupos
  const groups = await Promise.all([
    ["Maré Alta · Comunidade 1", 1018, true], ["Maré Alta · Comunidade 2", 996, true], ["Maré Alta · Comunidade 3", 742, true], ["Maré Alta · Avisos VIP", 2756, true], ["Maré Alta · Resultados", 4, false],
  ].map(([name, size, com], i) => db.group.create({ data: { jid: `1203630000000${i}@g.us`, name: String(name), size: Number(size), isCommunity: !!com, isResults: !com, iAmAdmin: true, inviteCode: `Demo${i}`, description: com ? "Lançamentos antes, cupons da comunidade e votação das estampas." : "Relatórios e comandos da equipe." } })));
  const community = groups.slice(0, 4);
  // contatos e entradas/saídas dos últimos 90 dias
  const people = CUSTOMERS.slice(0, 900);
  await db.contact.createMany({ data: people.map((c) => ({ phone: c.phone, name: c.name, firstSeenAt: ago(Math.floor(r() * 120)) })) });
  const contacts = await db.contact.findMany();
  const byPhone = new Map(contacts.map((c) => [c.phone, c]));
  const ms: { groupId: string; contactId: string; joinedAt: Date; leftAt: Date | null }[] = [];
  const ev: { type: "JOIN" | "LEAVE" | "RETURN"; groupId: string; contactId: string; createdAt: Date; byAdmin?: boolean; winbackSent?: boolean }[] = [];
  people.forEach((p, i) => {
    const g = community[i % 4];
    const c = byPhone.get(p.phone)!;
    const d = Math.floor(Math.pow(r(), 0.8) * 90);
    const joined = ago(d, r() * 20);
    const left = r() < 0.12 ? ago(Math.max(0, d - Math.floor(r() * 20) - 1), r() * 10) : null;
    ms.push({ groupId: g.id, contactId: c.id, joinedAt: joined, leftAt: left });
    ev.push({ type: r() < 0.06 ? "RETURN" : "JOIN", groupId: g.id, contactId: c.id, createdAt: joined });
    if (left) ev.push({ type: "LEAVE", groupId: g.id, contactId: c.id, createdAt: left, winbackSent: r() < 0.6 });
  });
  await db.membership.createMany({ data: ms });
  await db.memberEvent.createMany({ data: ev });

  // leads do formulário do Grupo VIP (anúncio de lead e orgânico)
  const leadPeople = CUSTOMERS.slice(500, 860);
  await db.lead.createMany({
    data: leadPeople.map((p, i) => {
      const paid = r() < 0.7;
      const st = r();
      return {
        name: p.name, phone: p.phone, email: p.email, source: "grupo-vip", createdAt: ago(Math.floor(Math.pow(r(), 0.9) * 60), r() * 20),
        utmSource: paid ? "meta" : r() < 0.5 ? "instagram" : null, utmMedium: paid ? "paid" : "bio", utmCampaign: paid ? "238004" : null, utmTerm: paid ? "2380041" : null, utmContent: paid ? `2380041${(i % 3) + 1}` : null,
        status: st < 0.55 ? "no_grupo" : st < 0.68 ? "cliente" : "novo", welcomeSent: true,
      };
    }),
  });

  // recuperação de carrinho e Pix
  const rec: import("@prisma/client").Prisma.RecoveryCaseCreateManyInput[] = [];
  for (let i = 0; i < 46; i++) {
    const c = CUSTOMERS[900 + i];
    const p = PRODUCTS[i % PRODUCTS.length];
    const kind = i < 32 ? "carrinho" : "pix";
    const d = Math.floor(r() * 14);
    const recovered = r() < 0.27;
    rec.push({ kind, refId: `demo-${kind}-${i}`, phone: c.phone, name: c.name, email: c.email, value: p.price, product: p.title, status: recovered ? "recuperado" : d < 2 ? "ativo" : r() < 0.5 ? "sem_resposta" : "concluido", step: recovered ? 2 : 1, sentCount: recovered ? 2 : 1, createdAt: ago(d, r() * 10), recoveredAt: recovered ? ago(Math.max(0, d - 1)) : null, recoveredValue: recovered ? p.price : null });
  }
  await db.recoveryCase.createMany({ data: rec });

  // atendimento
  const chats: [string, string, [boolean, string, string][]][] = [
    ["Gustavo Lima", "Tem o rashguard Tide Breaker no G?", [[false, "cliente", "Boa tarde! Tem o rashguard Tide Breaker no G?"], [true, "ia", "Boa tarde, Gustavo! Tem sim, temos 14 no G. Quer o link?"], [false, "cliente", "Quero sim"]]],
    ["Camila Rocha", "Meu pedido chega quando?", [[false, "cliente", "Oi, meu pedido #5821 chega quando?"], [true, "ia", "Oi, Camila! Seu pedido saiu ontem pelos Correios e a previsão é quinta-feira."]]],
    ["Felipe Duarte", "Posso trocar o tamanho?", [[false, "cliente", "Comprei M e ficou apertado, posso trocar pelo G?"]]],
    ["Ana Martins", "Obrigada!", [[false, "cliente", "Chegou certinho, obrigada!"], [true, "equipe", "Que bom, Ana! Marca a gente no story 🙌"]]],
    ["Diego Pereira", "Qual o prazo para Floripa?", [[false, "cliente", "Qual o prazo de entrega para Florianópolis?"]]],
  ];
  for (const [i, [name, last, msgs]] of chats.entries()) {
    const phone = CUSTOMERS[1000 + i].phone;
    await db.chatThread.create({ data: { phone, name, lastText: last, lastAt: ago(0, i * 2 + 0.3), unread: msgs[msgs.length - 1][0] ? 0 : 1, aiEnabled: true } });
    await db.chatMessage.createMany({ data: msgs.map(([fromMe, by, text], k) => ({ phone, fromMe, by, text, createdAt: ago(0, i * 2 + 1 - k * 0.2) })) });
  }

  await db.task.createMany({ data: [
    { title: "Aprovar criativos da semana", status: "a_fazer", priority: "alta", dueDate: ago(-1) },
    { title: "Fotos da coleção nova com os atletas", status: "fazendo", priority: "normal", dueDate: ago(-3) },
    { title: "Repor Fight Short Tide Breaker GG", status: "a_fazer", priority: "alta", dueDate: ago(0) },
    { title: "Pagar comissões dos atletas", status: "a_fazer", priority: "normal", dueDate: ago(-2) },
    { title: "Responder parceiro de Floripa", status: "feito", priority: "baixa" },
  ] });
  const gj = community.map((g) => g.jid);
  await db.scheduledMessage.createMany({ data: [
    { text: "Amanhã às 19h abre a coleção Verão. Membros do grupo compram com 10% usando COMUNIDADE10.", groupJids: gj, sendAt: ago(-1, -2), status: "SCHEDULED" },
    { text: "Votação aberta: qual estampa entra no próximo drop?", groupJids: gj, sendAt: ago(-3, -4), status: "SCHEDULED" },
    { text: "Chegou reposição dos kimonos A2. Corre que acaba rápido.", groupJids: gj, sendAt: ago(2), status: "SENT", sentCount: 4 },
    { text: "Live hoje 20h com o Tiago Guerra mostrando os rashguards novos.", groupJids: gj, sendAt: ago(6), status: "SENT", sentCount: 4 },
  ] });
  const poll = await db.poll.create({ data: { question: "Qual estampa entra no próximo drop?", options: ["Coral Reef 2", "Night Swell Neon", "Lagoa Tie-dye"], groupJids: gj, mode: "pagina", createdAt: ago(2) } });
  await db.pollVote.createMany({ data: people.slice(0, 240).map((p, i) => ({ pollId: poll.id, phone: p.phone, name: p.name, option: i % 7 < 3 ? 0 : i % 7 < 6 ? 1 : 2 })) });
  await db.launch.create({ data: { name: "Coleção Verão", opensAt: ago(-1, -2), groupJids: gj, goal: 6000, status: "planejado", about: "Rashguards e boardshorts novos." } });
  await db.funnel.createMany({ data: [
    { name: "Boas-vindas do lead", trigger: "lead_novo", active: true, steps: [{ delayMin: 1, text: "Oi {nome}! Aqui é da Maré Alta. Seu link do grupo: {link}" }] },
    { name: "Primeira compra", trigger: "primeira_compra", active: true, steps: [{ delayMin: 4320, text: "Oi {nome}, chegou tudo certo? Conta pra gente!" }] },
  ] });
  await db.cost.createMany({ data: [
    { kind: "FIXED", description: "Aluguel do galpão", amount: 3800, recurring: true, month: day().slice(0, 7) },
    { kind: "FIXED", description: "Equipe (3 pessoas)", amount: 9600, recurring: true, month: day().slice(0, 7) },
    { kind: "FIXED", description: "Ferramentas e aplicativos", amount: 640, recurring: true, month: day().slice(0, 7) },
    { kind: "FIXED", description: "Contabilidade", amount: 650, recurring: true, month: day().slice(0, 7) },
    { kind: "VARIABLE", description: "Sessão de fotos da coleção", amount: 1800, month: day().slice(0, 7) },
  ] });

  // atletas
  for (const [i, a] of ATHLETES.entries()) {
    const ref = await db.referral.create({ data: { phone: `552198800000${i}`, name: a.name, code: a.code, kind: a.kind, instagram: a.ig.replace("@", ""), payout: "pix", discountPct: a.pct, discountType: "percent", discountId: `gid://shopify/DiscountCodeNode/77${i}`, active: true, createdAt: ago(200) } });
    if (i < 2) await db.payout.create({ data: { referralId: ref.id, month: ago(35).toISOString().slice(0, 7), sales: 4200 + i * 900, amount: 336 + i * 72, paidAt: ago(28) } });
  }

  // clube
  const prizes = await Promise.all([
    db.clubPrize.create({ data: { title: "Boné Trucker Maré", points: 600, productId: PRODUCTS[11].id } }),
    db.clubPrize.create({ data: { title: "Camiseta Classic Wave", points: 1000, productId: PRODUCTS[9].id } }),
    db.clubPrize.create({ data: { title: "Rashguard Tide Breaker", points: 2400, productId: PRODUCTS[0].id } }),
  ]);
  void prizes;
  for (let i = 0; i < 40; i++) {
    const c = CUSTOMERS[i * 7];
    const joined = Math.floor(r() * 110) + 1;
    const late = i % 13 === 5, canceled = i % 17 === 9;
    const paidUntil = late ? ago(3) : ago(-(Math.floor(r() * 28) + 2));
    const pts = Math.floor(r() * 1400) + 50;
    const m = await db.clubMember.create({ data: { name: c.name, cpf: c.cpf, phone: c.phone, email: c.email, customerId: c.id, code: CLUB_CODE_FOR(i), discountId: `gid://shopify/DiscountCodeNode/66${i}`, codeActive: !canceled, status: canceled ? "cancelado" : "ativo", fee: 29.9, paidUntil, points: pts, joinedAt: ago(joined), provider: "appmax", subscriptionId: String(8000 + i), payMethod: i % 3 ? "cartao" : "pix", cardLast4: i % 3 ? String(4000 + i * 37).slice(-4) : null, lastChargeAt: ago(Math.max(0, joined % 30)), lastChargeStatus: late ? "falhou" : "pago", failReason: late ? "Saldo insuficiente" : null, nextChargeAt: paidUntil, canceledAt: canceled ? ago(5) : null } });
    await db.clubPoints.createMany({ data: [
      { memberId: m.id, delta: 50, reason: "mensalidade", ref: `m-${i}`, note: "Mensalidade paga", createdAt: ago(joined) },
      { memberId: m.id, delta: pts - 50, reason: "compra", ref: `c-${i}`, note: `Pedido #${5600 + i * 3}`, createdAt: ago(Math.floor(joined / 2)) },
    ] });
    if (i < 12) await db.clubEvent.create({ data: { memberId: m.id, kind: late ? "falhou" : "assinou", text: late ? "Cobrança recusada: saldo insuficiente" : `Assinou o clube pelo ${i % 3 ? "cartão" : "Pix"}`, value: 29.9, createdAt: ago(Math.min(joined, i), r() * 8) } });
  }
}
