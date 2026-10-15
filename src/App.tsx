import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { PanelLeftClose, PanelLeftOpen, Zap, Bell, CheckCheck } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { ChatInput } from "./components/ChatInput";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { HeaderInfo } from "./components/HeaderInfo";
import {
  ALL_MODELS,
  DEFAULT_MODEL,
  FILE_DEFAULT_MODEL,
  OPENROUTER_FILE_MODELS,
} from "./lib/models";
import { MAX_FILE_SIZE, detectKind } from "./lib/files";
import {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
} from "./server/conversations";
import { uploadFile, deleteFile } from "./server/files";
import { chat } from "./server/chat";
import { getDailyUsage } from "./server/usage";
import { listNotifications, markAllNotificationsRead } from "./server/notifications";
import { DAILY_MESSAGE_LIMIT, FILE_DAILY_LIMIT, type DailyUsage } from "./lib/limits";
import type { AppNotification, Conversation, FileAttachment, Message } from "./lib/types";

const OPENROUTER_SELECTION_NOTICE = `Text via OpenRouter — counts toward your ${FILE_DAILY_LIMIT} OpenRouter requests/day (shared with file tasks).`;

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function App() {
  const [userId, setUserId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<
    Array<{ id: string; message: string; variant: "default" | "openrouter" }>
  >([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const loadedRef = useRef<Set<string>>(new Set());
  const toastedIdsRef = useRef<Set<string>>(new Set());
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const refreshUsage = useCallback((uid: string) => {
    getDailyUsage({ data: { userId: uid } })
      .then(setUsage)
      .catch(() => {});
  }, []);

  const pushToast = useCallback(
    (n: AppNotification, durationMs = 8000, variant: "default" | "openrouter" = "default") => {
      if (toastedIdsRef.current.has(n.id)) return;
      toastedIdsRef.current.add(n.id);
      const toastId = n.id;
      setToasts((prev) => [...prev.slice(-2), { id: toastId, message: n.message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, durationMs);
    },
    []
  );

  const refreshNotifications = useCallback(
    (uid: string) => {
      listNotifications({ data: { userId: uid } })
        .then((list) => {
          setNotifications(list);
          // Toast the newest unseen notification (e.g. limit blocks decided
          // server-side before the stream starts).
          const newest = list[0];
          if (newest && !newest.read) pushToast(newest);
        })
        .catch(() => {});
    },
    [pushToast]
  );

  const handleNotifBell = useCallback(() => {
    setNotifOpen((open) => {
      if (!open && userId) {
        markAllNotificationsRead({ data: { userId } })
          .then(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))))
          .catch(() => {});
      }
      return !open;
    });
  }, [userId]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!notifPanelRef.current?.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [notifOpen]);

  useEffect(() => {
    let id = localStorage.getItem("sk-ai-user-id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("sk-ai-user-id", id);
    }
    setUserId(id);
    listConversations({ data: { userId: id } })
      .then((convs) => setConversations(convs))
      .catch((e) => setError(errMsg(e)));
    refreshUsage(id);
    refreshNotifications(id);
  }, [refreshUsage, refreshNotifications]);

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  // Files → OpenRouter's free file-capable models; text → any free model
  // (APInex or OpenRouter, each with its own per-user quotas).
  const fileMode = attachments.length > 0;
  const modelPool = fileMode ? OPENROUTER_FILE_MODELS : ALL_MODELS;

  const remaining = usage ? usage.text.remaining : DAILY_MESSAGE_LIMIT;
  const exhausted = usage !== null && remaining === 0;

  const updateConv = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? fn(c) : c));
      const idx = next.findIndex((c) => c.id === id);
      if (idx > 0) {
        const [conv] = next.splice(idx, 1);
        next.unshift(conv);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const current = activeConv ? activeConv.model : model;
    if (modelPool.some((m) => m.id === current)) return;
    const fallback = fileMode ? FILE_DEFAULT_MODEL : DEFAULT_MODEL;
    setModel(fallback);
    if (activeId) {
      updateConv(activeId, (c) => ({ ...c, model: fallback }));
    }
  }, [fileMode, activeConv, activeId, model, modelPool, updateConv]);

  const handleSelect = useCallback(
    async (id: string) => {
      setActiveId(id);
      setError(null);
      if (window.innerWidth < 768) setSidebarOpen(false);
      if (loadedRef.current.has(id)) return;
      loadedRef.current.add(id);
      try {
        const full = await getConversation({ data: { userId, conversationId: id } });
        if (full) {
          setConversations((prev) => prev.map((c) => (c.id === id ? full : c)));
        }
      } catch (e) {
        setError(errMsg(e));
      }
    },
    [userId]
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (!userId || streaming || !content.trim()) return;
      setError(null);
      const atts = attachments;
      setAttachments([]);

      let conv = activeId ? conversations.find((c) => c.id === activeId) ?? null : null;
      let convId = conv?.id ?? null;

      if (!conv || !convId) {
        convId = uuidv4();
        const title = content.slice(0, 40) + (content.length > 40 ? "..." : "");
        const convModel = model;
        try {
          await createConversation({
            data: { id: convId, userId, title, model: convModel },
          });
        } catch (e) {
          setAttachments(atts);
          setError(errMsg(e));
          return;
        }
        const now = Date.now();
        conv = { id: convId, title, model: convModel, messages: [], createdAt: now, updatedAt: now };
        loadedRef.current.add(convId);
        setConversations((prev) => [conv as Conversation, ...prev]);
        setActiveId(convId);
      }

      const userMsg: Message = {
        id: uuidv4(),
        role: "user",
        content,
        timestamp: Date.now(),
        attachments: atts.length > 0 ? atts : undefined,
      };
      updateConv(convId, (c) => ({
        ...c,
        messages: [...c.messages, userMsg],
        updatedAt: Date.now(),
      }));

      setStreaming(true);
      setStreamText("");
      setStreamStatus("Connecting…");
      try {
        const res = (await chat({
          data: {
            userId,
            conversationId: convId,
            model: conv.model,
            userMessageId: userMsg.id,
            content,
            attachmentIds: atts.map((a) => a.id),
          },
        })) as unknown as Response;

        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => "");
          throw new Error(body || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let servedModel: string | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                if (json?.error?.message) {
                  throw new Error(String(json.error.message));
                }
                if (typeof json?.status === "string") {
                  setStreamStatus(json.status);
                  continue;
                }
                if (json?.notify?.id) {
                  const n = json.notify as AppNotification;
                  setNotifications((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
                  pushToast(n);
                  continue;
                }
                if (typeof json?.served === "string") {
                  servedModel = json.served;
                  continue;
                }
                const delta = json?.choices?.[0]?.delta?.content;
                if (typeof delta === "string") {
                  if (!acc) setStreamStatus(null);
                  acc += delta;
                  setStreamText(acc);
                }
              } catch (err) {
                if (err instanceof Error && err.message && !(err instanceof SyntaxError)) throw err;
                // ignore keep-alive frames
              }
            }
          }
        }

        if (acc) {
          const assistantMsg: Message = {
            id: uuidv4(),
            role: "assistant",
            content: acc,
            timestamp: Date.now(),
            model: servedModel ?? undefined,
          };
          updateConv(convId, (c) => ({
            ...c,
            messages: [...c.messages, assistantMsg],
            updatedAt: Date.now(),
          }));
        }
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setStreaming(false);
        setStreamText("");
        setStreamStatus(null);
        if (userId) {
          refreshUsage(userId);
          refreshNotifications(userId);
        }
      }
    },
    [userId, streaming, attachments, activeId, conversations, model, updateConv, refreshUsage, refreshNotifications, pushToast]
  );

  const handleNew = useCallback(() => {
    setActiveId(null);
    setError(null);
    setAttachments([]);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
      if (userId) {
        deleteConversation({ data: { userId, conversationId: id } }).catch(() => {});
      }
    },
    [activeId, userId]
  );

  const handleModelChange = useCallback(
    (nextModel: string) => {
      setModel(nextModel);
      if (activeId) {
        updateConv(activeId, (c) => ({ ...c, model: nextModel }));
      }
      const next = ALL_MODELS.find((m) => m.id === nextModel);
      if (next?.route === "openrouter" && userId) {
        const notice: AppNotification = {
          id: crypto.randomUUID(),
          kind: "info",
          message: OPENROUTER_SELECTION_NOTICE,
          createdAt: Date.now(),
          read: false,
        };
        pushToast(notice, 10000, "openrouter");
        setTimeout(() => {
          setNotifications((prev) => [notice, ...prev]);
        }, 10000);
      }
    },
    [activeId, pushToast, updateConv, userId]
  );

  const handleAddFiles = useCallback(
    async (files: File[]) => {
      if (!userId) return;
      setError(null);
      for (const file of files) {
        try {
          if (file.size > MAX_FILE_SIZE) {
            throw new Error(`${file.name}: maximum file size is 5 MB.`);
          }
          const kind = detectKind(file.name, file.type);
          if (!kind) {
            throw new Error(
              `${file.name}: unsupported type. Allowed: images, PDF, and text/code files.`
            );
          }
          const dataBase64 = await fileToBase64(file);
          const att = await uploadFile({
            data: {
              userId,
              conversationId: activeId,
              filename: file.name,
              contentType: file.type,
              dataBase64,
            },
          });
          setAttachments((prev) => [...prev, att]);
        } catch (e) {
          setError(errMsg(e));
        }
      }
    },
    [userId, activeId]
  );

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (userId) {
        deleteFile({ data: { userId, fileId: id } }).catch(() => {});
      }
    },
    [userId]
  );

  return (
    <div className="flex h-[100dvh] bg-zinc-950 text-zinc-100">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[auto_1fr] items-center gap-2 border-b border-zinc-800 px-4 py-2.5 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeftOpen className="h-5 w-5" />
              )}
            </button>
            {activeConv && (
              <>
                <h2 className="min-w-0 truncate text-sm font-medium text-zinc-300">
                  {activeConv.title}
                </h2>
                <span className="hidden shrink-0 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400 sm:inline-block">
                  {activeConv.model}
                </span>
              </>
            )}
          </div>

          <div data-testid="header-notices" className="hidden items-center gap-1 sm:flex">
            <HeaderInfo />
          </div>

          <div className="flex items-center justify-end gap-2">
            <span
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                exhausted
                  ? "border-amber-900/60 bg-amber-950/40 text-amber-500"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
              }`}
              title="Messages used today (resets at midnight UTC)"
            >
              <Zap className={`h-3 w-3 ${exhausted ? "text-amber-500" : "text-violet-400"}`} />
              <span className="hidden sm:inline">
                Free plan · {remaining} of {DAILY_MESSAGE_LIMIT} messages left today
                {exhausted && " — resets midnight UTC"}
              </span>
              <span className="sm:hidden">
                {remaining}/{DAILY_MESSAGE_LIMIT}
                {exhausted && " · UTC"}
              </span>
            </span>

            <div ref={notifPanelRef} className="relative">
              <button
                onClick={handleNotifBell}
                data-testid="notif-bell"
                aria-label="Notifications"
                className="relative rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Bell className="h-5 w-5" />
                {notifications.some((n) => !n.read) && (
                  <span
                    data-testid="notif-badge"
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-medium text-white"
                  >
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div
                  data-testid="notif-panel"
                  className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                    <span className="text-xs font-semibold text-zinc-300">Notifications</span>
                    <button
                      onClick={() =>
                        markAllNotificationsRead({ data: { userId } })
                          .then(() =>
                            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                          )
                          .catch(() => {})
                      }
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-zinc-500">
                        No notifications yet — quota updates and model switches appear here.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          data-testid="notif-item"
                          className={`border-b border-zinc-800/60 px-3 py-2.5 text-left last:border-b-0 ${
                            n.read ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && (
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                            )}
                            <div className={n.read ? "ml-3.5" : ""}>
                              <p className="text-xs leading-relaxed text-zinc-300">{n.message}</p>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                {new Date(n.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {activeConv ? (
          <>
            <ChatArea
              messages={activeConv.messages}
              streaming={streaming}
              streamText={streamText}
              streamStatus={streamStatus}
            />
            <ChatInput
              model={activeConv.model}
              onModelChange={handleModelChange}
              onSend={handleSend}
              attachments={attachments}
              onAddFiles={handleAddFiles}
              onRemoveAttachment={handleRemoveAttachment}
              error={error}
              onDismissError={() => setError(null)}
              disabled={streaming}
              models={modelPool}
              mode={fileMode ? "file" : "text"}
            />
          </>
        ) : (
          <>
            <WelcomeScreen onPromptClick={handleSend} usage={usage} fileMode={fileMode} />
            <ChatInput
              model={model}
              onModelChange={handleModelChange}
              onSend={handleSend}
              attachments={attachments}
              onAddFiles={handleAddFiles}
              onRemoveAttachment={handleRemoveAttachment}
              error={error}
              onDismissError={() => setError(null)}
              disabled={streaming}
              models={modelPool}
              mode={fileMode ? "file" : "text"}
            />
          </>
        )}
      </main>

      <div className="pointer-events-none fixed bottom-[calc(12.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 sm:bottom-24">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid="toast"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-xl shadow-black/40 ${
              t.variant === "openrouter"
                ? "border-amber-700/70 bg-amber-950/90"
                : "border-zinc-700 bg-zinc-900"
            }`}
            style={{ animation: "toast-in 200ms ease-out" }}
          >
            <Bell
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                t.variant === "openrouter" ? "text-amber-400" : "text-violet-400"
              }`}
            />
            <p
              className={`text-xs leading-relaxed ${
                t.variant === "openrouter" ? "text-amber-200" : "text-zinc-300"
              }`}
            >
              {t.message}
            </p>
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
