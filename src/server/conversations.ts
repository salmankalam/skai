import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import type { Conversation, Message } from "../lib/types";

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  attachments: string | null;
  timestamp: number;
}

function toConversation(row: ConversationRow, messages: Message[]): Conversation {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    role: row.role as Message["role"],
    content: row.content,
    timestamp: row.timestamp,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
  };
}

export const listConversations = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<Conversation[]> => {
    const res = await env.DB.prepare(
      `SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC`
    )
      .bind(data.userId)
      .all<ConversationRow>();
    return res.results.map((row) => toConversation(row, []));
  });

export const getConversation = createServerFn({ method: "GET" })
  .validator((data: { userId: string; conversationId: string }) => data)
  .handler(async ({ data }): Promise<Conversation | null> => {
    const conv = await env.DB.prepare(
      `SELECT * FROM conversations WHERE id = ? AND user_id = ?`
    )
      .bind(data.conversationId, data.userId)
      .first<ConversationRow>();
    if (!conv) return null;

    const msgs = await env.DB.prepare(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC`
    )
      .bind(data.conversationId)
      .all<MessageRow>();

    return toConversation(conv, msgs.results.map(toMessage));
  });

export const createConversation = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; userId: string; title: string; model: string }) => data
  )
  .handler(async ({ data }): Promise<Conversation> => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO conversations (id, user_id, title, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(data.id, data.userId, data.title, data.model, now, now)
      .run();
    return {
      id: data.id,
      title: data.title,
      model: data.model,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .validator((data: { userId: string; conversationId: string }) => data)
  .handler(async ({ data }) => {
    const conv = await env.DB.prepare(
      `SELECT id FROM conversations WHERE id = ? AND user_id = ?`
    )
      .bind(data.conversationId, data.userId)
      .first();
    if (!conv) return { ok: false as const };

    const files = await env.DB.prepare(
      `SELECT r2_key FROM files WHERE conversation_id = ? AND user_id = ?`
    )
      .bind(data.conversationId, data.userId)
      .all<{ r2_key: string }>();

    await Promise.all(files.results.map((f) => env.FILES.delete(f.r2_key)));

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM messages WHERE conversation_id = ?`).bind(data.conversationId),
      env.DB.prepare(`DELETE FROM files WHERE conversation_id = ? AND user_id = ?`).bind(
        data.conversationId,
        data.userId
      ),
      env.DB.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`).bind(
        data.conversationId,
        data.userId
      ),
    ]);

    return { ok: true as const };
  });
