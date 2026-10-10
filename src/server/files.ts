import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { MAX_FILE_SIZE, detectKind } from "../lib/files";
import type { FileAttachment } from "../lib/types";

function base64ByteLength(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const uploadFile = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId: string;
      conversationId: string | null;
      filename: string;
      contentType: string;
      dataBase64: string;
    }) => data
  )
  .handler(async ({ data }): Promise<FileAttachment> => {
    const kind = detectKind(data.filename, data.contentType);
    if (!kind) {
      throw new Error(
        "Unsupported file type. Allowed: images (png, jpg, gif, webp), PDF, and text/code files."
      );
    }

    const size = base64ByteLength(data.dataBase64);
    if (size > MAX_FILE_SIZE) {
      throw new Error("File too large — maximum size is 5 MB.");
    }

    const id = crypto.randomUUID();
    const contentType = data.contentType || "application/octet-stream";

    await env.DB.prepare(
      `INSERT INTO files (id, user_id, conversation_id, filename, content_type, size, r2_key, created_at, data)
       VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)`
    )
      .bind(id, data.userId, data.conversationId, data.filename, contentType, size, Date.now(), data.dataBase64)
      .run();

    return { id, filename: data.filename, contentType, size, kind };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .validator((data: { userId: string; fileId: string }) => data)
  .handler(async ({ data }) => {
    const row = await env.DB.prepare(
      `SELECT id FROM files WHERE id = ? AND user_id = ?`
    )
      .bind(data.fileId, data.userId)
      .first();
    if (!row) return { ok: false as const };

    await env.DB.prepare(`DELETE FROM files WHERE id = ? AND user_id = ?`)
      .bind(data.fileId, data.userId)
      .run();

    return { ok: true as const };
  });
