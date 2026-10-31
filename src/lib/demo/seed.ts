// Popula o banco da demonstração com a loja fictícia. Roda ao subir e de novo toda madrugada.
import bcrypt from "bcryptjs";
import { db } from "../db";
import { ATHLETES, CLUB_CODE_FOR, CLUB_CUSTOMER, CLUB_SIZE, CUSTOMERS, PRODUCTS } from "./data";

export const DEMO_EMAIL = "visitante@mare-alta.demo";
const day = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const SEED_V = 5; // muda quando os dados da demo mudam, para repopular no próximo deploy
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ago = (d: number, h = 0) => new Date(Date.now() - d * 864e5 - h * 3600_000);

let running: Promise<void> | null = null;
export async function ensureDemoSeed(force = false) {
  if (running) return running;
  running = (async () => {
    const fresh = async () => {
      const mark = await db.setting.findUnique({ where: { key: "_demo_seed" } }).catch(() => null);
      const mv = mark?.value as { day?: string; v?: number } | undefined;
      return !force && mv?.day === day() && mv?.v === SEED_V;
    };
    if (await fresh()) return;
    // painel e worker sobem juntos: só um processo popula (trava no Postgres enquanto durar)
    await db.$transaction(async (tx) => {
      const [{ ok }] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(424242) AS ok`;
      if (!ok || (await fresh())) return;
      await seed();
      await db.setting.upsert({ where: { key: "_demo_seed" }, create: { key: "_demo_seed", value: { day: day(), v: SEED_V } }, update: { value: { day: day(), v: SEED_V } } });
    }, { timeout: 600_000, maxWait: 10_000 });
  })().finally(() => { running = null; });
  return running;
}

async function seed() {
  const r = rng(Number(day().replace(/-/g, "")));
  // limpa tudo
  for (const m of ["pollVote", "poll", "broadcastRecipient", "broadcast", "chatMessage", "chatThread", "memberEvent", "membership", "contact", "group", "lead", "recoveryCase", "task", "scheduledMessage", "cost", "payout", "referral", "clubTicket", "clubMeet", "clubPerk", "clubRaffle", "clubAffPayout", "clubPoints", "clubReward", "clubEvent", "clubCheckout", "clubMember", "clubPrize", "launch", "funnelRun", "funnel", "waitlist", "optOut", "commandLog", "diagnosis", "setting", "user"] as const) {
    await (db[m] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
  await db.user.create({ data: { name: "Visitante", email: DEMO_EMAIL, passwordHash: await bcrypt.hash(String(Math.random()), 8), role: "ADMIN" } });
  const S = (key: string, value: object) => db.setting.create({ data: { key, value } });
  await S("_partners_seeded", { done: true });
  await S("_whatsapp", { state: "open", at: new Date().toISOString() });
  await S("_int_status", { shopify: { ok: true, msg: "Conectado à loja Maré Alta", at: new Date().toISOString() }, meta: { ok: true, msg: "Conectado à conta Maré Alta · Vendas", at: new Date().toISOString() }, appmax: { ok: true, msg: "Conectado (produção)", at: new Date().toISOString() } });
  await S("club", { name: "Maré Alta Club", autoDiscountId: "gid://shopify/DiscountAutomaticNode/1", segmentId: "gid://shopify/Segment/1", instagram: "marealta", earlyLink: "https://mare-alta.exemplo.com/collections/antecipado", t3Link: "https://mare-alta.exemplo.com/collections/club-3", t6Link: "https://mare-alta.exemplo.com/collections/club-6", t12Link: "https://mare-alta.exemplo.com/collections/club-12" });
  await S("ads", { accounts: [{ id: "1001", name: "Maré Alta · Vendas", on: true, kind: "auto" }, { id: "1002", name: "Maré Alta · Perfil", on: true, kind: "perfil" }], perfilCoupons: ["BEMVINDOIG"] });
  await S("postsale", { storeUrl: "https://mare-alta.exemplo.com" });

  // grupos
  const groups = await Promise.all([
    ["Maré Alta · Comunidade 1", 1021, true], ["Maré Alta · Comunidade 2", 1017, true], ["Maré Alta · Comunidade 3", 1009, true], ["Maré Alta · Comunidade 4", 1013, true], ["Maré Alta · Comunidade 5", 996, true], ["Maré Alta · Comunidade 6", 874, true], ["Maré Alta · Avisos VIP", 5931, true], ["Maré Alta · Resultados", 4, false],
  ].map(([name, size, com], i) => db.group.create({ data: { jid: `1203630000000${i}@g.us`, name: String(name), size: Number(size), isCommunity: !!com, isResults: !com, iAmAdmin: true, inviteCode: `Demo${i}`, description: com ? "Lançamentos antes, cupons da comunidade e votação das estampas." : "Relatórios e comandos da equipe." } })));
  const community = groups.slice(0, 7);
  // contatos e entradas/saídas dos últimos 90 dias
  const people = CUSTOMERS.slice(0, 3200);
  await db.contact.createMany({ data: people.map((c) => ({ phone: c.phone, name: c.name, firstSeenAt: ago(Math.floor(r() * 120)) })) });
  const contacts = await db.contact.findMany();
  const byPhone = new Map(contacts.map((c) => [c.phone, c]));
  const ms: { groupId: string; contactId: string; joinedAt: Date; leftAt: Date | null }[] = [];
  const ev: { type: "JOIN" | "LEAVE" | "RETURN"; groupId: string; contactId: string; createdAt: Date; byAdmin?: boolean; winbackSent?: boolean }[] = [];
  people.forEach((p, i) => {
    const g = community[i % 7];
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
  const leadPeople = CUSTOMERS.slice(3300, 4450);
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
  for (let i = 0; i < 140; i++) {
    const c = CUSTOMERS[5000 + i];
    const p = PRODUCTS[i % PRODUCTS.length];
    const kind = i < 96 ? "carrinho" : "pix";
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
  await db.pollVote.createMany({ data: people.slice(0, 1180).map((p, i) => ({ pollId: poll.id, phone: p.phone, name: p.name, option: i % 7 < 3 ? 0 : i % 7 < 6 ? 1 : 2 })) });
  await db.launch.create({ data: { name: "Coleção Verão", opensAt: ago(-1, -2), groupJids: gj, goal: 45000, status: "planejado", about: "Rashguards e boardshorts novos." } });
  await db.funnel.createMany({ data: [
    { name: "Boas-vindas do lead", trigger: "lead_novo", active: true, steps: [{ delayMin: 1, text: "Oi {nome}! Aqui é da Maré Alta. Seu link do grupo: {link}" }] },
    { name: "Primeira compra", trigger: "primeira_compra", active: true, steps: [{ delayMin: 4320, text: "Oi {nome}, chegou tudo certo? Conta pra gente!" }] },
  ] });
  await db.cost.createMany({ data: [
    { kind: "FIXED", description: "Aluguel do galpão", amount: 7500, recurring: true, month: day().slice(0, 7) },
    { kind: "FIXED", description: "Equipe (7 pessoas)", amount: 24500, recurring: true, month: day().slice(0, 7) },
    { kind: "FIXED", description: "Ferramentas e aplicativos", amount: 1900, recurring: true, month: day().slice(0, 7) },
    { kind: "FIXED", description: "Contabilidade", amount: 1400, recurring: true, month: day().slice(0, 7) },
    { kind: "VARIABLE", description: "Sessão de fotos da coleção", amount: 6800, month: day().slice(0, 7) },
  ] });

  // atletas
  for (const [i, a] of ATHLETES.entries()) {
    const ref = await db.referral.create({ data: { phone: `552198800000${i}`, name: a.name, code: a.code, kind: a.kind, instagram: a.ig.replace("@", ""), payout: "pix", discountPct: a.pct, discountType: "percent", discountId: `gid://shopify/DiscountCodeNode/77${i}`, active: true, createdAt: ago(200) } });
    if (i < 2) await db.payout.create({ data: { referralId: ref.id, month: ago(35).toISOString().slice(0, 7), sales: 18400 + i * 5200, amount: 1840 + i * 520, paidAt: ago(28) } });
  }

  // clube
  const prizes = await Promise.all([
    db.clubPrize.create({ data: { title: "Boné Trucker Maré", points: 600, productId: PRODUCTS[11].id } }),
    db.clubPrize.create({ data: { title: "Camiseta Classic Wave", points: 1000, productId: PRODUCTS[9].id } }),
    db.clubPrize.create({ data: { title: "Rashguard Tide Breaker", points: 2400, productId: PRODUCTS[0].id } }),
  ]);
  void prizes;
  const mem: import("@prisma/client").Prisma.ClubMemberCreateManyInput[] = [];
  const meta: { joined: number; pts: number; late: boolean; i: number }[] = [];
  for (let i = 0; i < CLUB_SIZE; i++) {
    const c = CLUB_CUSTOMER(i);
    const joined = Math.floor(Math.pow(r(), 0.8) * 410) + 1;
    const late = i % 41 === 5, canceled = i % 23 === 9;
    const paidUntil = late ? ago(3) : ago(-(Math.floor(r() * 28) + 2));
    const pts = Math.floor(Math.pow(r(), 1.5) * 1100) + 50;
    meta.push({ joined, pts, late, i });
    const months = Math.floor(joined / 30.4);
    const tg = months >= 12 ? 12 : months >= 6 ? 6 : months >= 3 ? 3 : 0;
    const bmonth = i % 12 === 0 ? new Date().getMonth() : Math.floor(r() * 12);
    const sizes = ["P", "M", "M", "G", "G", "GG"];
    mem.push({ birthDate: new Date(Date.UTC(1975 + Math.floor(r() * 30), bmonth, 1 + Math.floor(r() * 27), 12)), instagram: r() < 0.8 ? `${c.name.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}.${["surf", "bjj", "rio", "onda", "jj"][i % 5]}${i % 97}` : null, closeFriends: !canceled && joined > 6 && r() < 0.9, shirtSize: sizes[i % sizes.length], address: { zip: "22790701", street: "Av. das Américas", number: String(100 + (i % 900)), district: "Barra da Tijuca", city: c.city, state: c.state }, refCode: `${c.name.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "")}${i}`, tierGiven: tg, monthUses: Math.floor(r() * 3), usesMonth: new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7),
      name: c.name, cpf: c.cpf, phone: c.phone, email: c.email, customerId: c.id, code: CLUB_CODE_FOR(i), discountId: `gid://shopify/DiscountCodeNode/66${i}`, codeActive: !canceled, status: canceled ? "cancelado" : "ativo", fee: 29.9, paidUntil, points: pts, joinedAt: ago(joined), provider: "appmax", subscriptionId: String(80000 + i), payMethod: i % 3 ? "cartao" : "pix", cardLast4: i % 3 ? String(4000 + i * 37).slice(-4) : null, lastChargeAt: ago(Math.max(0, joined % 30)), lastChargeStatus: late ? "falhou" : "pago", failReason: late ? "Saldo insuficiente" : null, nextChargeAt: paidUntil, canceledAt: canceled ? ago(5) : null });
  }
  await db.clubMember.createMany({ data: mem });
  const ids = new Map((await db.clubMember.findMany({ select: { id: true, code: true } })).map((m) => [m.code, m.id]));
  const pts: import("@prisma/client").Prisma.ClubPointsCreateManyInput[] = [];
  const evs: import("@prisma/client").Prisma.ClubEventCreateManyInput[] = [];
  for (const { joined, pts: p, late, i } of meta) {
    const memberId = ids.get(CLUB_CODE_FOR(i))!;
    pts.push({ memberId, delta: 50, reason: "mensalidade", ref: `m-${i}`, note: "Mensalidade paga", createdAt: ago(joined) });
    pts.push({ memberId, delta: p - 50, reason: "compra", ref: `c-${i}`, note: `Pedido #${5600 + i * 3}`, createdAt: ago(Math.floor(joined / 2)) });
    if (i < 30) evs.push({ memberId, kind: late ? "falhou" : "assinou", text: late ? "Cobrança recusada: saldo insuficiente" : `Assinou o clube pelo ${i % 3 ? "cartão" : "Pix"}`, value: 29.9, createdAt: ago(Math.floor(i / 3), r() * 8) });
  }
  await db.clubPoints.createMany({ data: pts });
  // indicação: alguns membros trouxeram outros
  const allIds = meta.map(({ i }) => ids.get(CLUB_CODE_FOR(i))!);
  const refIdx = [3, 8, 15, 21, 40, 57];
  for (let k = 0; k < 160; k++) {
    const by = allIds[refIdx[k % refIdx.length] + (k % 13 === 0 ? 7 : 0)];
    const who = allIds[200 + k * 7];
    if (by && who && by !== who) await db.clubMember.update({ where: { id: who }, data: { referredById: by } });
  }
  // brindes: kits dos que entraram agora e brindes de nível
  const recent = meta.filter((x) => x.joined <= 4).slice(0, 9);
  for (const [k, x] of recent.entries()) {
    const memberId = ids.get(CLUB_CODE_FOR(x.i))!;
    await db.clubPerk.create({ data: { memberId, kind: "kit", title: "Kit de boas-vindas do club (camiseta + patch da bandeira)", status: k === 2 ? "sem_endereco" : "criado", orderId: k === 2 ? null : `gid://shopify/Order/${31000 + k}`, orderName: k === 2 ? null : `#${31000 + k}` } });
    if (k === 2) await db.clubMember.update({ where: { id: memberId }, data: { address: (await import("@prisma/client")).Prisma.DbNull } });
  }
  const t3 = meta.filter((x) => x.joined >= 92 && x.joined <= 95).slice(0, 3);
  for (const [k, x] of t3.entries()) await db.clubPerk.create({ data: { memberId: ids.get(CLUB_CODE_FOR(x.i))!, kind: "nivel3", title: "Boné do club (3 meses de club)", status: "criado", orderId: `gid://shopify/Order/${31100 + k}`, orderName: `#${31100 + k}` } });
  const t12 = meta.find((x) => x.joined >= 366);
  if (t12) await db.clubPerk.create({ data: { memberId: ids.get(CLUB_CODE_FOR(t12.i))!, kind: "nivel12", title: "Peça exclusiva (12 meses de club)", status: "criado", orderId: "gid://shopify/Order/31200", orderName: "#31200" } });
  // aniversariantes do mês com cupom
  const bdays = await db.clubMember.findMany({ where: { status: "ativo" }, select: { id: true, name: true, birthDate: true } });
  const thisMonth = bdays.filter((m) => m.birthDate && m.birthDate.getUTCMonth() === new Date().getMonth());
  const eom = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59);
  await db.clubReward.createMany({ data: thisMonth.map((m, k) => ({ memberId: m.id, code: `NIVER${m.name.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6)}${k}X`, value: 0, points: 0, kind: "aniversario", expiresAt: eom, usedAt: k % 4 === 0 ? ago(k % 9) : null, createdAt: ago(Math.min(5, new Date().getDate() - 1)) })), skipDuplicates: true });
  // eventos com pontos
  const meets = await Promise.all([
    db.clubMeet.create({ data: { title: "Open mat Maré Alta", date: ago(-9, -10), points: 300, slots: 40, place: "Academia parceira, Barra" } }),
    db.clubMeet.create({ data: { title: "Seminário de jiu-jitsu com Mestre Joca", date: ago(-23, -9), points: 800, slots: 60, place: "CT Maré Alta" } }),
    db.clubMeet.create({ data: { title: "Noite de lutas", date: ago(-37, -19), points: 500, slots: 80 } }),
  ]);
  const tk: import("@prisma/client").Prisma.ClubTicketCreateManyInput[] = [];
  meets.forEach((e, j) => { for (let k = 0; k < [27, 21, 14][j]; k++) tk.push({ meetId: e.id, memberId: allIds[(k * 11 + j * 5) % allIds.length] }); });
  await db.clubTicket.createMany({ data: tk, skipDuplicates: true });
  // sorteio do mês passado
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).toISOString().slice(0, 7);
  const pw = [allIds[11], allIds[47], allIds[90], allIds[133]];
  const names = await db.clubMember.findMany({ where: { id: { in: pw } }, select: { id: true, name: true } });
  const nm = new Map(names.map((x) => [x.id, x.name]));
  await db.clubRaffle.create({ data: { month: prev, winners: [["Rashguard da coleção nova", pw[0]], ["Vídeo análise da sua luta por um atleta do time", pw[1]], ["Vídeo análise da sua luta por um atleta do time", pw[2]], ["Aula particular com atleta do time", pw[3]]].map(([prize, id]) => ({ prize, memberId: id, name: nm.get(id) ?? "" })), drawnAt: ago(new Date().getDate() + 1) } });
  await db.clubEvent.createMany({ data: evs });

}
