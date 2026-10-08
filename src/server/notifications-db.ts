import { env } from "cloudflare:workers";
import type { AppNotification } from "../lib/types";

/** Persists a notification for a user; returns the row for live streaming to the client. */
export async function saveNotification(
  userId: string,
  kind: AppNotification["kind"],
  message: string
): Promise<AppNotification> {
  const n: AppNotification = {
    id: crypto.randomUUID(),
    kind,
    message,
    createdAt: Date.now(),
    read: false,
  };
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, kind, message, created_at, read) VALUES (?, ?, ?, ?, ?, 0)`
  )
    .bind(n.id, userId, kind, n.message, n.createdAt)
    .run();
  return n;
}
