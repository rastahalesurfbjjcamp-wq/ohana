import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

let _conn: IORedis | null = null;
export function redis() {
  if (!_conn) _conn = new IORedis(env.redisUrl(), { maxRetriesPerRequest: null });
  return _conn;
}

let _queue: Queue | null = null;
export function queue() {
  if (!_queue) _queue = new Queue("ohana", { connection: redis() });
  return _queue;
}

export type JobName = "tick" | "send-scheduled" | "winback" | "sync-groups" | "daily-report" | "command";

export async function enqueue(name: JobName, data: Record<string, unknown> = {}, opts: { delayMs?: number; jobId?: string } = {}) {
  return queue().add(name, data, {
    delay: opts.delayMs,
    jobId: opts.jobId,
    removeOnComplete: 500,
    removeOnFail: 1000,
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
  });
}
