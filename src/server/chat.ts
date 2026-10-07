import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { DEFAULT_MODEL, VISION_FALLBACK_MODEL, hasVision, isFreeModel } from "../lib/models";
import { MAX_TEXT_INJECT_CHARS, detectKind } from "../lib/files";
import { DAILY_MESSAGE_LIMIT } from "../lib/limits";
import { countTodayMessages } from "./daily-limit";
import type { FileAttachment } from "../lib/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ChatRequest {
  userId: string;
  conversationId: string;
  model: string;
  userMessageId: string;
  content: string;
  attachmentIds: string[];
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

interface FileRow {
  id: string;
  filename: string;
  content_type: string;
  r2_key: string;
  kind: FileAttachment["kind"];
}

async function loadFileRows(userId: string, ids: string[]): Promise<FileRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const res = await env.DB.prepare(
    `SELECT id, filename, content_type, r2_key FROM files
     WHERE user_id = ? AND id IN (${placeholders})`
  )
    .bind(userId, ...ids)
    .all<{ id: string; filename: string; content_type: string; r2_key: string }>();
  return res.results.map((row) => ({
    ...row,
    kind: detectKind(row.filename, row.content_type) ?? "text",
  }));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Plain-text file contents, injected as prompt context (free). */
async function loadTextContext(files: FileRow[]): Promise<string> {
  const parts: string[] = [];
  for (const f of files) {
    if (f.kind !== "text") continue;
    const obj = await env.FILES.get(f.r2_key);
    if (!obj) continue;
    let text = await obj.text();
    if (text.length > MAX_TEXT_INJECT_CHARS) {
      text = text.slice(0, MAX_TEXT_INJECT_CHARS) + "\n\n[...truncated...]";
    }
    parts.push(`<file name="${f.filename}">\n${text}\n</file>`);
  }
  return parts.join("\n\n");
}

/**
 * Parses OpenRouter SSE frames and accumulates `delta.content` text so the
 * assistant reply can be persisted to D1 when the stream ends.
 */
function createDeltaAccumulator() {
  let buffer = "";
  let text = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (typeof delta === "string") text += delta;
          } catch {
            // ignore partial/keep-alive frames
          }
        }
      }
    },
    text: () => text,
  };
}

export const chat = createServerFn({ method: "POST" })
  .validator((data: ChatRequest) => data)
  .handler(async ({ data }): Promise<Response> => {
    if (!data.content.trim()) throw new Error("Message is empty.");
    if (!isFreeModel(data.model)) throw new Error("Only free models are allowed.");

    const usedToday = await countTodayMessages(data.userId);
    if (usedToday >= DAILY_MESSAGE_LIMIT) {
      throw new Error(
        `Daily limit reached — ${DAILY_MESSAGE_LIMIT} messages per day per user. Your quota resets at midnight UTC.`
      );
    }

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Add it to .dev.vars for local dev, or run `wrangler secret put OPENROUTER_API_KEY` for production."
      );
    }

    const fileRows = await loadFileRows(data.userId, data.attachmentIds);
    const attachments = fileRows.map(
      (f): FileAttachment => ({
        id: f.id,
        filename: f.filename,
        contentType: f.content_type,
        size: 0,
        kind: f.kind,
      })
    );

    const hasImages = fileRows.some((f) => f.kind === "image");
    const hasPdf = fileRows.some((f) => f.kind === "pdf");
    const model =
      hasImages && !hasVision(data.model) ? VISION_FALLBACK_MODEL : data.model;

    // Build the user turn: [text-file contexts] [prompt] [images] [pdfs]
    const textContext = await loadTextContext(fileRows);
    const mediaParts: ContentPart[] = [];
    for (const f of fileRows) {
      const obj = await env.FILES.get(f.r2_key);
      if (!obj) continue;
      if (f.kind === "image") {
        const b64 = bytesToBase64(new Uint8Array(await obj.arrayBuffer()));
        mediaParts.push({
          type: "image_url",
          image_url: { url: `data:${f.content_type};base64,${b64}` },
        });
      } else if (f.kind === "pdf") {
        const b64 = bytesToBase64(new Uint8Array(await obj.arrayBuffer()));
        mediaParts.push({
          type: "file",
          file: { filename: f.filename, file_data: `data:application/pdf;base64,${b64}` },
        });
      }
    }

    const userContent: ContentPart[] = [];
    if (textContext) userContent.push({ type: "text", text: `Relevant attached files:\n\n${textContext}` });
    userContent.push({ type: "text", text: data.content });
    userContent.push(...mediaParts);

    // Persist the user message before streaming.
    await env.DB.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, attachments, timestamp)
       VALUES (?, ?, 'user', ?, ?, ?)`
    )
      .bind(data.userMessageId, data.conversationId, data.content, JSON.stringify(attachments), Date.now())
      .run();
    await env.DB.prepare(
      `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`
    )
      .bind(Date.now(), data.conversationId, data.userId)
      .run();

    // Prior turns: re-inject text-file context so follow-up questions keep working.
    const historyRows = await env.DB.prepare(
      `SELECT id, role, content, attachments FROM messages
       WHERE conversation_id = ? AND id != ? ORDER BY timestamp ASC`
    )
      .bind(data.conversationId, data.userMessageId)
      .all<{ id: string; role: string; content: string; attachments: string | null }>();

    const historyAtts = new Map<string, FileAttachment[]>();
    const historyFileIds = new Set<string>();
    for (const row of historyRows.results) {
      if (row.attachments) {
        const atts: FileAttachment[] = JSON.parse(row.attachments);
        historyAtts.set(row.id, atts);
        for (const a of atts) historyFileIds.add(a.id);
      }
    }
    const historyFiles = await loadFileRows(data.userId, [...historyFileIds]);
    const historyFileMap = new Map(historyFiles.map((f) => [f.id, f]));

    const history: Array<{ role: string; content: string | ContentPart[] }> = [];
    for (const row of historyRows.results) {
      const atts = historyAtts.get(row.id);
      if (row.role === "user" && atts && atts.length > 0) {
        const ownFiles = atts
          .map((a) => historyFileMap.get(a.id))
          .filter((f): f is FileRow => Boolean(f));
        const ctx = await loadTextContext(ownFiles);
        history.push({
          role: "user",
          content: ctx ? `Relevant attached files:\n\n${ctx}\n\n${row.content}` : row.content,
        });
      } else {
        history.push({ role: row.role, content: row.content });
      }
    }
    history.push({ role: "user", content: userContent });

    // Only free tools: `cloudflare-ai` PDF engine is free (never mistral-ocr).
    const body = JSON.stringify({
      model,
      stream: true,
      messages: history,
      ...(hasPdf
        ? { plugins: [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }] }
        : {}),
    });

    const orRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "SK-AI",
      },
      body,
    });

    if (!orRes.ok || !orRes.body) {
      const errText = await orRes.text().catch(() => "");
      throw new Error(`OpenRouter error (${orRes.status}): ${errText.slice(0, 300)}`);
    }

    const upstream = orRes.body;
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const accumulator = createDeltaAccumulator();
    const assistantId = crypto.randomUUID();

    const persistAssistant = async () => {
      const text = accumulator.text();
      if (!text) return;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO messages (id, conversation_id, role, content, attachments, timestamp)
           VALUES (?, ?, 'assistant', ?, NULL, ?)`
        ).bind(assistantId, data.conversationId, text, Date.now()),
        env.DB.prepare(
          `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`
        ).bind(Date.now(), data.conversationId, data.userId),
      ]);
    };

    (async () => {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulator.push(chunk);
          await writer.write(value);
        }
        await persistAssistant();
        await writer.close();
      } catch (err) {
        // Client disconnected or stream broke — keep whatever was generated.
        try {
          await persistAssistant();
        } catch {
          // best effort
        }
        try {
          await writer.abort(err);
        } catch {
          // already closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  });
