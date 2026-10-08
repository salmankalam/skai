import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Paperclip } from "lucide-react";
import type { Message } from "../lib/types";

interface ChatAreaProps {
  messages: Message[];
  streaming: boolean;
  streamText: string;
  streamStatus: string | null;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const MD_COMPONENTS = {
  p: (props: ComponentProps<"p">) => <p className="my-1 first:mt-0 last:mb-0" {...props} />,
  h1: (props: ComponentProps<"h1">) => <h1 className="mt-3 mb-1.5 text-lg font-semibold" {...props} />,
  h2: (props: ComponentProps<"h2">) => <h2 className="mt-3 mb-1.5 text-base font-semibold" {...props} />,
  h3: (props: ComponentProps<"h3">) => <h3 className="mt-2.5 mb-1 text-[15px] font-semibold" {...props} />,
  h4: (props: ComponentProps<"h4">) => <h4 className="mt-2 mb-1 font-semibold" {...props} />,
  ul: (props: ComponentProps<"ul">) => <ul className="my-1 list-disc space-y-0.5 pl-5" {...props} />,
  ol: (props: ComponentProps<"ol">) => <ol className="my-1 list-decimal space-y-0.5 pl-5" {...props} />,
  li: (props: ComponentProps<"li">) => <li className="leading-relaxed" {...props} />,
  a: (props: ComponentProps<"a">) => <a className="text-violet-400 underline underline-offset-2" {...props} />,
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote className="my-1 border-l-2 border-zinc-600 pl-3 text-zinc-400" {...props} />
  ),
  hr: () => <hr className="my-2 border-zinc-700" />,
  table: (props: ComponentProps<"table">) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]" {...props} />
    </div>
  ),
  th: (props: ComponentProps<"th">) => (
    <th className="border border-zinc-700 bg-zinc-900/60 px-2 py-1 font-medium" {...props} />
  ),
  td: (props: ComponentProps<"td">) => <td className="border border-zinc-700 px-2 py-1" {...props} />,
  pre: (props: ComponentProps<"pre">) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs" {...props} />
  ),
  code: ({ className, children, ...props }: ComponentProps<"code">) => {
    const isBlock = /language-/.test(className ?? "") || String(children).includes("\n");
    if (isBlock) return <code className={className} {...props}>{children}</code>;
    return (
      <code className="rounded bg-zinc-950/70 px-1 py-0.5 text-[12px] text-violet-300" {...props}>
        {children}
      </code>
    );
  },
};

function MarkdownContent({ text }: { text: string }) {
  return <Markdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{text}</Markdown>;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div data-role={message.role} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-violet-600" : "bg-zinc-800"
        }`}
      >
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-violet-400" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-violet-600 text-white"
              : "bg-zinc-800 text-zinc-200"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <div className="break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <MarkdownContent text={message.content} />
            </div>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex max-w-[180px] items-center gap-1.5 rounded-lg border border-zinc-600/60 bg-zinc-700/50 px-2 py-1 text-[11px] text-zinc-200"
                >
                  <Paperclip className="h-3 w-3 shrink-0 text-violet-300" />
                  <span className="truncate">{att.filename}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-[10px] text-zinc-600">
          {formatTime(message.timestamp)}
          {message.model && ` · ${message.model}`}
        </p>
      </div>
    </div>
  );
}

export function ChatArea({ messages, streaming, streamText, streamStatus }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, streamStatus]);

  useEffect(() => {
    if (!streaming) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [streaming]);

  const slowHint = elapsed >= 12 && !streamText;
  const statusLine = streaming ? (streamStatus ?? "Waiting for a reply…") : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streaming && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
              <Bot className="h-4 w-4 text-violet-400" />
            </div>
            <div className="max-w-[85%]">
              <div className="inline-block rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-200">
                {streamText ? (
                  <div className="break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <MarkdownContent text={streamText} />
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-400" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-400" />
                    <span>{statusLine}</span>
                  </div>
                )}
              </div>
              {statusLine && (
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  {statusLine}
                  {slowHint && " — free models can take up to a minute under load"}
                </p>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
