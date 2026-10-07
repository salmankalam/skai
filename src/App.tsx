import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { ChatInput } from "./components/ChatInput";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { DEMO_CONVERSATIONS } from "./lib/demo-data";
import { DEFAULT_MODEL } from "./lib/models";
import type { Conversation, Message } from "./lib/types";

export default function App() {
  const [userId, setUserId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const streamRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("sk-ai-user-id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("sk-ai-user-id", id);
    }
    setUserId(id);
  }, []);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  const simulateStreaming = useCallback((fullText: string) => {
    setStreaming(true);
    setStreamText("");
    let i = 0;
    const chunkSize = 3;

    const tick = () => {
      i += chunkSize;
      setStreamText(fullText.slice(0, i));
      if (i < fullText.length) {
        streamRef.current = setTimeout(tick, 15);
      } else {
        setStreaming(false);
        setStreamText("");
      }
    };
    streamRef.current = setTimeout(tick, 100);
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      const userMsg: Message = {
        id: uuidv4(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      let convId = activeId;
      if (!convId) {
        convId = uuidv4();
        const newConv: Conversation = {
          id: convId,
          title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
          model: DEFAULT_MODEL,
          messages: [userMsg],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(convId);
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() }
              : c
          )
        );
      }

      const responses: Record<string, string> = {
        default: `You asked about "${content.slice(0, 50)}". This is a simulated response for the SK-AI demo.\n\nIn production, this would be a real AI response streamed from OpenRouter. The response supports **markdown** formatting:\n\n- Lists and bullet points\n- \`inline code\` and code blocks\n- **Bold** and *italic* text\n\nTry asking about code, Cloudflare, or anything else!`,
        code: `Here's a React example related to your question:\n\n\`\`\`typescript\nfunction useChat() {\n  const [messages, setMessages] = useState<Message[]>([]);\n  const [loading, setLoading] = useState(false);\n\n  const send = async (content: string) => {\n    setLoading(true);\n    // Send to API...\n    setLoading(false);\n  };\n\n  return { messages, send, loading };\n}\n\`\`\`\n\nThis pattern is used in the SK-AI codebase.`,
        cloudflare: `Cloudflare Workers provide a serverless runtime that executes at the edge. Key features:\n\n- **Global deployment** — runs in 300+ locations\n- **Zero cold starts** — V8 isolates spin up instantly\n- **KV storage** — perfect for conversation history\n- **D1 database** — SQLite at the edge\n\nSK-AI uses Workers KV to store your conversations as JSON.`,
      };

      const lower = content.toLowerCase();
      let responseKey = "default";
      if (lower.includes("code") || lower.includes("react") || lower.includes("function")) {
        responseKey = "code";
      } else if (lower.includes("cloudflare") || lower.includes("worker") || lower.includes("deploy")) {
        responseKey = "cloudflare";
      }

      const responseText = responses[responseKey];

      setTimeout(() => {
        simulateStreaming(responseText);

        setTimeout(() => {
          const assistantMsg: Message = {
            id: uuidv4(),
            role: "assistant",
            content: responseText,
            timestamp: Date.now(),
          };
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
                : c
            )
          );
        }, (responseText.length / 3) * 15 + 200);
      }, 300);
    },
    [activeId, simulateStreaming]
  );

  const handleNew = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  const handleModelChange = useCallback(
    (model: string) => {
      if (activeId) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, model } : c))
        );
      }
    },
    [activeId]
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) clearTimeout(streamRef.current);
    };
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      <main className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
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
              <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-300">
                {activeConv.title}
              </h2>
              <span className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400">
                {activeConv.model}
              </span>
            </>
          )}
        </header>
        {activeConv ? (
          <>
            <ChatArea
              messages={activeConv.messages}
              streaming={streaming}
              streamText={streamText}
            />
            <ChatInput
              model={activeConv.model}
              onModelChange={handleModelChange}
              onSend={handleSend}
              disabled={streaming}
            />
          </>
        ) : (
          <>
            <WelcomeScreen onPromptClick={handleSend} />
            <ChatInput
              model={DEFAULT_MODEL}
              onModelChange={() => {}}
              onSend={handleSend}
              disabled={streaming}
            />
          </>
        )}
      </main>
    </div>
  );
}
