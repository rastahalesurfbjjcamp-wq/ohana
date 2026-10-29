// Cache em memória com "mostra o que já tem e atualiza por trás" (as telas abrem na hora)
// e junta pedidos iguais que chegam ao mesmo tempo numa chamada só.
const store = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_STALE = 30 * 60_000; // mostra o último dado na hora e atualiza por trás

function load<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((value) => { store.set(key, { at: Date.now(), value }); return value; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function swr<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < ttlMs) return hit.value as T;
  if (hit && age < Math.max(MAX_STALE, ttlMs * 2)) {
    load(key, fn).catch(() => null); // atualiza por trás
    return hit.value as T;
  }
  if (store.size > 400) for (const [k, v] of store) if (Date.now() - v.at > MAX_STALE) store.delete(k);
  return load(key, fn);
}

export function forget(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
