import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import type { AppNotification } from "../lib/types";

export const listNotifications = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<AppNotification[]> => {
    const res = await env.DB.prepare(
      `SELECT id, kind, message, created_at, read FROM notifications
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
      .bind(data.userId)
      .all<{ id: string; kind: AppNotification["kind"]; message: string; created_at: number; read: number }>();
    return res.results.map((r) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      createdAt: r.created_at,
      read: r.read === 1,
    }));
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<void> => {
    await env.DB.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`)
      .bind(data.userId)
      .run();
  });

export const createNotification = createServerFn({ method: "POST" })
  .validator((data: { userId: string; kind: AppNotification["kind"]; message: string }) => data)
  .handler(async ({ data }): Promise<AppNotification> => {
    const createdAt = Date.now();
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, kind, message, created_at, read) VALUES (?, ?, ?, ?, ?, 0)`
    )
      .bind(id, data.userId, data.kind, data.message, createdAt)
      .run();
    return {
      id,
      kind: data.kind,
      message: data.message,
      createdAt,
      read: false,
    };
  });
