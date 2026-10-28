"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Recarrega a página de tempos em tempos (ex.: esperando o QR code ser lido)
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
