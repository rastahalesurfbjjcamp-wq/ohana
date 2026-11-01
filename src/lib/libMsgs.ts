import { db } from "./db";
import type { Part } from "./flowTypes";
import type { LibMsg } from "@/components/LibraryPicker";

export async function libMsgs(): Promise<LibMsg[]> {
  const list = await db.messageTemplate.findMany({ orderBy: [{ folder: "asc" }, { name: "asc" }] }).catch(() => []);
  return list.map((t) => ({ id: t.id, name: t.name, folder: t.folder, text: ((t.parts ?? []) as Part[]).map((p) => p.text ?? "").filter(Boolean).join("\n\n") })).filter((m) => m.text);
}
