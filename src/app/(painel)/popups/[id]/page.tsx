import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { cfgOf } from "@/lib/popups";
import { Builder } from "./Builder";

export const dynamic = "force-dynamic";

export default async function PopupEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, lists] = await Promise.all([
    db.popup.findUnique({ where: { id } }),
    db.contactList.findMany({ where: { dynamic: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  return <Builder id={p.id} name={p.name} active={p.active} cfg={cfgOf(p)} lists={lists} appUrl={env.appUrl()} store={env.storeName()} />;
}
