import { env } from "cloudflare:workers";

export function utcDayStart(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export async function countTodayMessages(userId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS used FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.user_id = ? AND m.role = 'user' AND m.timestamp >= ?`
  )
    .bind(userId, utcDayStart())
    .first<{ used: number }>();
  return row?.used ?? 0;
}
