import { createServerFn } from "@tanstack/react-start";
import type { Conversation } from "../lib/types";

const kv = () => (globalThis as any).__KV__ as KVNamespace;

export const getConversations = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const key = `user:${userId}:conversations`;
    const raw = await kv().get(key);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  });

export const getConversation = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const conversationId = context.conversationId as string;
    const key = `user:${userId}:conversations`;
    const raw = await kv().get(key);
    if (!raw) return null;
    const conversations = JSON.parse(raw) as Conversation[];
    return conversations.find((c) => c.id === conversationId) ?? null;
  });

export const saveConversation = createServerFn({ method: "POST" })
  .handler(async ({ context, data }) => {
    const userId = context.userId as string;
    const conversation = data.conversation as Conversation;
    const key = `user:${userId}:conversations`;
    const raw = await kv().get(key);
    const conversations: Conversation[] = raw ? JSON.parse(raw) : [];
    const idx = conversations.findIndex((c) => c.id === conversation.id);
    if (idx >= 0) {
      conversations[idx] = conversation;
    } else {
      conversations.unshift(conversation);
    }
    await kv().put(key, JSON.stringify(conversations));
    return conversation;
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .handler(async ({ context, data }) => {
    const userId = context.userId as string;
    const conversationId = data.conversationId as string;
    const key = `user:${userId}:conversations`;
    const raw = await kv().get(key);
    if (!raw) return;
    const conversations: Conversation[] = JSON.parse(raw);
    const filtered = conversations.filter((c) => c.id !== conversationId);
    await kv().put(key, JSON.stringify(filtered));
  });
