"use client";
// Escolher uma mensagem pronta da biblioteca para preencher o texto
import { Library } from "lucide-react";

export type LibMsg = { id: string; name: string; folder: string; text: string };

export function LibraryPicker({ items, onPick }: { items: LibMsg[]; onPick: (text: string) => void }) {
  if (!items.length) return null;
  const folders = [...new Set(items.map((i) => i.folder || "Sem pasta"))];
  return (
    <label className="libpick">
      <Library size={14} />
      <select value="" onChange={(e) => { const m = items.find((x) => x.id === e.target.value); if (m) onPick(m.text); }}>
        <option value="">Usar mensagem da biblioteca</option>
        {folders.map((f) => <optgroup key={f} label={f}>{items.filter((i) => (i.folder || "Sem pasta") === f).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>)}
      </select>
    </label>
  );
}
