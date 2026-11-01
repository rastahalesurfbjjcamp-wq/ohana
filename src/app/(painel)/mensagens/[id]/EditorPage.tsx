"use client";
import { useRouter } from "next/navigation";
import { MessageEditor, type TemplateData } from "@/components/MessageEditor";

export function EditorPage({ initial, folders }: { initial: TemplateData; folders: string[] }) {
  const router = useRouter();
  return <MessageEditor initial={initial} folders={folders} onSaved={(t) => { if (!initial.id) router.replace(`/mensagens/${t.id}`); else router.refresh(); }} />;
}
