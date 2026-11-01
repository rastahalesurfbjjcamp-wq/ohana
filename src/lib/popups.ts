// Popups de captura no site: config pública, sorteio de prêmio e gravação do lead.
import { db } from "./db";
import { normalizePhone } from "./segments";
import { defaultCfg, type PopupCfg, type Prize } from "./popupTypes";
export * from "./popupTypes";

export function cfgOf(p: { kind: string; config: unknown }): PopupCfg {
  const d = defaultCfg(p.kind);
  const c = (p.config ?? {}) as Partial<PopupCfg>;
  return { ...d, ...c, fields: { ...d.fields, ...c.fields }, success: { ...d.success, ...c.success }, colors: { ...d.colors, ...c.colors }, trigger: { ...d.trigger, ...c.trigger }, audience: { ...d.audience, ...c.audience } };
}

// O que o script do site precisa (sem códigos de cupom de jogo, que só saem depois do cadastro)
export async function publicPopups() {
  const list = await db.popup.findMany({ where: { active: true }, orderBy: { updatedAt: "desc" } });
  const now = Date.now();
  return list
    .map((p) => ({ id: p.id, kind: p.kind, cfg: cfgOf(p) }))
    .filter(({ cfg }) => (!cfg.audience.start || Date.parse(cfg.audience.start) <= now) && (!cfg.audience.end || Date.parse(cfg.audience.end) >= now))
    .map(({ id, kind, cfg }) => {
      const { listId: _l, tag: _t, ...rest } = cfg;
      return { id, kind, cfg: { ...rest, game: cfg.game ? { type: cfg.game.type, prizes: cfg.game.prizes.map((x) => ({ label: x.label })) } : undefined, success: { ...cfg.success, coupon: cfg.game ? undefined : cfg.success.coupon } } };
    });
}

export function draw(prizes: Prize[]) {
  const total = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  let r = Math.random() * (total || 1);
  for (let i = 0; i < prizes.length; i++) {
    r -= Math.max(0, prizes[i].weight);
    if (r <= 0) return i;
  }
  return 0;
}

export async function popupLead(id: string, body: Record<string, string>) {
  const p = await db.popup.findUnique({ where: { id } });
  if (!p) return { ok: false as const, error: "Popup não encontrado" };
  const cfg = cfgOf(p);
  const phone = normalizePhone(body.phone ?? "");
  if (!phone) return { ok: false as const, error: "Confira o número do WhatsApp" };
  const name = (body.name ?? "").trim().slice(0, 80) || null;
  const email = (body.email ?? "").trim().slice(0, 120) || null;
  const existed = await db.lead.findUnique({ where: { phone }, select: { id: true } });
  await db.lead.upsert({
    where: { phone },
    create: {
      phone, name, email,
      birthday: (body.birthday ?? "").trim().slice(0, 10) || null,
      source: `popup:${p.name}`.slice(0, 40),
      utmSource: body.utm_source?.slice(0, 60) || null,
      utmMedium: body.utm_medium?.slice(0, 60) || null,
      utmCampaign: body.utm_campaign?.slice(0, 80) || null,
      utmContent: body.utm_content?.slice(0, 80) || null,
      utmTerm: body.utm_term?.slice(0, 80) || null,
    },
    update: { name: name ?? undefined, email: email ?? undefined },
  });
  if (cfg.listId) await db.listMember.createMany({ data: [{ listId: cfg.listId, phone, name, email }], skipDuplicates: true }).catch(() => null);
  if (cfg.tag) await db.contactTag.createMany({ data: [{ phone, tag: cfg.tag.toLowerCase() }], skipDuplicates: true }).catch(() => null);
  await db.popup.update({ where: { id }, data: { leads: { increment: 1 } } });
  let prize: number | undefined;
  let coupon = cfg.success.coupon;
  let label: string | undefined;
  if (cfg.game?.prizes.length) {
    prize = draw(cfg.game.prizes);
    coupon = cfg.game.prizes[prize].code;
    label = cfg.game.prizes[prize].label;
  }
  if (!existed) await import("./funnels").then((m) => m.funnelEvent("lead_novo", phone, name)).catch(() => null);
  return { ok: true as const, prize, coupon, label, link: cfg.success.link };
}
