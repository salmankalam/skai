import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { ALL_MODELS, NARA_FREE_MODELS, OPENROUTER_FILE_MODELS, isFreeModel } from "../lib/models";
import { MAX_TEXT_INJECT_CHARS, detectKind } from "../lib/files";
import { DAILY_MESSAGE_LIMIT, FILE_DAILY_LIMIT, OPENROUTER_GLOBAL_LIMIT, GLOBAL_USER } from "../lib/limits";
import { getUsage, getGlobalUsage, incrementUsage, setGlobalUsage } from "./provider-usage";
import { saveNotification } from "./notifications-db";
import { base64ToBytes } from "./files";
import type { AppNotification, FileAttachment } from "../lib/types";

const NARA_URL = "https://router.bynara.id/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Extracts a readable message from either provider's error envelope. */
async function providerErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text);
    const msg = json?.error?.message;
    if (typeof msg === "string" && msg) return msg.slice(0, 300);
  } catch {
    // not JSON — fall through
  }
  return text.slice(0, 300) || `HTTP ${res.status}`;
}

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
  data: string | null;
  kind: FileAttachment["kind"];
}

async function loadFileRows(userId: string, ids: string[]): Promise<FileRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const res = await env.DB.prepare(
    `SELECT id, filename, content_type, data FROM files
     WHERE user_id = ? AND id IN (${placeholders})`
  )
    .bind(userId, ...ids)
    .all<{ id: string; filename: string; content_type: string; data: string | null }>();
  return res.results.map((row) => ({
    ...row,
    kind: detectKind(row.filename, row.content_type) ?? "text",
  }));
}

/** Plain-text file contents, injected as prompt context (free). */
function loadTextContext(files: FileRow[]): string {
  const parts: string[] = [];
  for (const f of files) {
    if (f.kind !== "text" || !f.data) continue;
    let text = new TextDecoder().decode(base64ToBytes(f.data));
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

    const modelEntry = ALL_MODELS.find((m) => m.id === data.model);
    if (!isFreeModel(data.model) || !modelEntry) {
      throw new Error("Only free models are allowed.");
    }
    const route = modelEntry.route;
    const hasAttachments = data.attachmentIds.length > 0;

    if (hasAttachments && route !== "openrouter") {
      throw new Error(
        "Files are answered by OpenRouter's file-capable free models — choose one from the model selector."
      );
    }

    if (route === "nara") {
      const used = await getUsage(data.userId, "nara");
      if (used >= DAILY_MESSAGE_LIMIT) {
        const msg = `Daily limit reached — ${DAILY_MESSAGE_LIMIT} messages per day per user. Your quota resets at midnight UTC.`;
        await saveNotification(data.userId, "limit", msg);
        throw new Error(msg);
      }
      if (!env.NARA_API_KEY) {
        throw new Error(
          "NARA_API_KEY is not set. Add it to .dev.vars for local dev, or run `wrangler secret put NARA_API_KEY` for production."
        );
      }
    } else {
      const globalUsed = await getGlobalUsage("openrouter");
      if (globalUsed >= OPENROUTER_GLOBAL_LIMIT) {
        const msg = `OpenRouter's free requests are being used by other users right now — unavailable until midnight UTC. Text chat via NaraRouter still works.`;
        await saveNotification(data.userId, "global", msg);
        throw new Error(msg);
      }
      const used = await getUsage(data.userId, "openrouter");
      if (used >= FILE_DAILY_LIMIT) {
        const msg = `OpenRouter request limit reached — ${FILE_DAILY_LIMIT} requests per day per user (text and files). Your quota resets at midnight UTC. Text chat via NaraRouter still works.`;
        await saveNotification(data.userId, "limit", msg);
        throw new Error(msg);
      }
      if (!env.OPENROUTER_API_KEY) {
        throw new Error(
          "OPENROUTER_API_KEY is not set — file tasks are unavailable. Add it to .dev.vars for local dev, or run `wrangler secret put OPENROUTER_API_KEY` for production."
        );
      }
    }

    // Consume quota before hitting the provider so retries can't bypass limits.
    await incrementUsage(data.userId, route);
    const pendingNotifs: AppNotification[] = [];
    if (route === "openrouter") {
      await incrementUsage(GLOBAL_USER, "openrouter");
      const userAfter = await getUsage(data.userId, "openrouter");
      pendingNotifs.push(
        await saveNotification(
          data.userId,
          "info",
          `OpenRouter request recorded — ${Math.max(0, FILE_DAILY_LIMIT - userAfter)} of ${FILE_DAILY_LIMIT} left today.`
        )
      );
    }

    const apiKey = route === "nara" ? env.NARA_API_KEY : env.OPENROUTER_API_KEY;

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

    const hasPdf = fileRows.some((f) => f.kind === "pdf");

    // Build the user turn: [text-file contexts] [prompt] [images] [pdfs]
    const textContext = loadTextContext(fileRows);
    const mediaParts: ContentPart[] = [];
    for (const f of fileRows) {
      if (!f.data) continue;
      if (f.kind === "image") {
        mediaParts.push({
          type: "image_url",
          image_url: { url: `data:${f.content_type};base64,${f.data}` },
        });
      } else if (f.kind === "pdf") {
        mediaParts.push({
          type: "file",
          file: { filename: f.filename, file_data: `data:application/pdf;base64,${f.data}` },
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
    const buildBody = (modelId: string) =>
      JSON.stringify({
        model: modelId,
        stream: true,
        messages: history,
        ...(route === "openrouter" && hasPdf
          ? { plugins: [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }] }
          : {}),
      });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (route === "openrouter") headers["X-Title"] = "SK-AI";

    const doFetch = async (modelId: string) => {
      // Dead upstreams can hang before response headers — abort so retries proceed.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FIRST_BYTE_DEADLINE_MS);
      try {
        return await fetch(route === "nara" ? NARA_URL : OPENROUTER_URL, {
          method: "POST",
          headers,
          body: buildBody(modelId),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };

    // Free upstream pools fail often (immediate `event: error` frames or
    // silent hangs). Read early frames before responding so a dead stream
    // can be retried and only surfaces as a clean error if it stays dead.
    const FIRST_BYTE_DEADLINE_MS = 15_000;

    /** Tries one model up to `attempts` times; resolves a healthy Response or null. */
    const tryModel = async (
      modelId: string,
      attempts: number,
      failureOut: { message: string },
      onRetry?: () => void
    ): Promise<Response | null> => {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (attempt > 1) onRetry?.();
        let res: Response;
        try {
          res = await doFetch(modelId);
        } catch {
          failureOut.message = "timed out waiting for a response";
          continue;
        }
        if (!res.ok || !res.body) {
          const message = await providerErrorMessage(res);
          if (route === "openrouter" && (res.status === 429 || res.status === 402)) {
            // Provider says we're out — stop ALL OpenRouter requests for today.
            await setGlobalUsage("openrouter", OPENROUTER_GLOBAL_LIMIT);
            const msg = `OpenRouter's free requests are being used by other users right now — unavailable until midnight UTC. Text chat via NaraRouter still works.`;
            await saveNotification(data.userId, "global", msg);
            throw new Error(msg);
          }
          failureOut.message = message;
          continue;
        }

        // Pull early chunks: proceed on real content, fail on upstream error frames.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const accEarly = createDeltaAccumulator();
        let errorSnippet = "";
        const deadline = setTimeout(() => reader.cancel().catch(() => {}), FIRST_BYTE_DEADLINE_MS);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accEarly.push(chunk);
            if (!errorSnippet) {
              const m = chunk.match(/"message"\s*:\s*"([^"]+)"/);
              if (m && /event: error|"error"\s*:/.test(chunk)) errorSnippet = m[1].slice(0, 200);
            }
            if (accEarly.text()) break; // real content started — stream is healthy
          }
        } catch {
          if (!errorSnippet) errorSnippet = "timed out waiting for a response";
        } finally {
          clearTimeout(deadline);
        }

        if (accEarly.text()) {
          // Healthy: re-wrap the response so the already-read prefix replays first.
          const acc = accEarly;
          return new Response(
            new ReadableStream({
              start(controller) {
                const replay = acc.text();
                if (replay) {
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ choices: [{ delta: { content: replay } }] })}\n\n`
                    )
                  );
                }
              },
              async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  return;
                }
                controller.enqueue(value);
              },
              cancel(reason) {
                return reader.cancel(reason);
              },
            }),
            { headers: { "Content-Type": "text/event-stream; charset=utf-8" } }
          );
        }
        failureOut.message = errorSnippet || "upstream error or timeout";
      }
      return null;
    };

    // Free models flap constantly — if the chosen model stays dead after
    // retries, fail over to sibling models on the same free tier (quota
    // was consumed once for the user action, not per attempt).
    const siblings =
      route === "nara" ? NARA_FREE_MODELS : OPENROUTER_FILE_MODELS;
    const fallbacks = siblings.map((m) => m.id).filter((id) => id !== data.model);
    const modelsToTry = [data.model, ...fallbacks.slice(0, 3)];
    const nameOf = (id: string) => ALL_MODELS.find((m) => m.id === id)?.name ?? id;

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const emit = async (obj: unknown) => {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      } catch {
        // client went away
      }
    };

    const accumulator = createDeltaAccumulator();
    const assistantId = crypto.randomUUID();
    let servedModelName = nameOf(data.model);

    const persistAssistant = async () => {
      const text = accumulator.text();
      if (!text) return;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO messages (id, conversation_id, role, content, attachments, timestamp, model)
           VALUES (?, ?, 'assistant', ?, NULL, ?, ?)`
        ).bind(assistantId, data.conversationId, text, Date.now(), servedModelName),
        env.DB.prepare(
          `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`
        ).bind(Date.now(), data.conversationId, data.userId),
      ]);
    };

    // Failover runs inside the stream so the client sees accurate live
    // status ("Connecting to X…", "X is slow — retrying…") while it happens.
    (async () => {
      try {
        for (const n of pendingNotifs) await emit({ notify: n });
        let providerRes: Response | null = null;
        const failure = { message: "" };
        let servedByIndex = 0;
        for (let i = 0; i < modelsToTry.length; i++) {
          const attempts = i === 0 ? 2 : 1; // chosen model gets one retry; fallbacks one shot
          await emit({
            status:
              i === 0
                ? `Connecting to ${nameOf(modelsToTry[i])}…`
                : `Trying ${nameOf(modelsToTry[i])}…`,
          });
          providerRes = await tryModel(modelsToTry[i], attempts, failure, () =>
            emit({ status: `${nameOf(modelsToTry[i])} is slow — retrying…` })
          );
          if (providerRes) {
            servedByIndex = i;
            servedModelName = nameOf(modelsToTry[i]);
            break;
          }
          const next = modelsToTry[i + 1];
          if (next) {
            await emit({ status: `${nameOf(modelsToTry[i])} isn't responding — trying ${nameOf(next)}…` });
          }
        }
        if (!providerRes) {
          const label = route === "nara" ? "NaraRouter" : "OpenRouter";
          throw new Error(
            `${label}: ${failure.message || "no response"} — all free ${label} models failed after retries. Try again in a moment.`
          );
        }
        if (servedByIndex > 0) {
          await emit({
            notify: await saveNotification(
              data.userId,
              "failover",
              `${nameOf(modelsToTry[0])} wasn't responding — your reply came from ${nameOf(modelsToTry[servedByIndex])} instead.`
            ),
          });
        }
        await emit({ served: servedModelName });

        const reader = providerRes.body!.getReader();
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
      } catch (err) {
        // Failover exhausted or kill-switch tripped — clean error frame.
        await emit({
          error: { message: err instanceof Error ? err.message : String(err) },
        });
        try {
          await writer.close();
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
