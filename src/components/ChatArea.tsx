import { useEffect, useRef } from "react";
import { Bot, User, Paperclip } from "lucide-react";
import type { Message } from "../lib/types";

interface ChatAreaProps {
  messages: Message[];
  streaming: boolean;
  streamText: string;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-violet-600" : "bg-zinc-800"
        }`}
      >
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-violet-400" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-violet-600 text-white"
              : "bg-zinc-800 text-zinc-200"
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content.split("\n").map((line, i) => {
              if (line.startsWith("```")) {
                return (
                  <pre key={i} className="my-2 rounded-lg bg-zinc-950 p-3 text-xs overflow-x-auto">
                    <code>{line.replace(/```\w*/g, "")}</code>
                  </pre>
                );
              }
              if (line.startsWith("## ")) {
                return <h3 key={i} className="mt-3 mb-1 font-semibold text-base">{line.slice(3)}</h3>;
              }
              if (line.startsWith("- ")) {
                return <p key={i} className="ml-2">• {line.slice(2)}</p>;
              }
              if (line.match(/^\d+\./)) {
                return <p key={i} className="ml-2">{line}</p>;
              }
              if (line.trim() === "") return <br key={i} />;
              return <p key={i}>{line}</p>;
            })}
          </div>
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
        <p className="mt-1 text-[10px] text-zinc-600">{formatTime(message.timestamp)}</p>
      </div>
    </div>
  );
}

export function ChatArea({ messages, streaming, streamText }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streaming && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
              <Bot className="h-4 w-4 text-violet-400" />
            </div>
            <div className="max-w-[75%]">
              <div className="inline-block rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-200">
                <div className="whitespace-pre-wrap break-words">
                  {streamText}
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
