import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./env";

export const uploadDir = () => process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf", mp3: "audio/mpeg", ogg: "audio/ogg",
};
export const mimeFor = (name: string) => MIME[name.split(".").pop() ?? ""] ?? "application/octet-stream";

// Salva o arquivo e devolve o link público e o tipo para a Evolution
export async function saveUpload(file: File): Promise<{ url: string; type: "image" | "video" | "document" }> {
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const name = `${randomUUID()}.${ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), Buffer.from(await file.arrayBuffer()));
  const mime = file.type || mimeFor(name);
  const type = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document";
  return { url: `${env.internalUrl().replace(/\/$/, "")}/api/media/${name}`, type };
}
