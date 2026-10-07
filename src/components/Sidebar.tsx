import { useState } from "react";
import { MessageSquare, Plus, Search, Trash2, Sparkles } from "lucide-react";
import type { Conversation } from "../lib/types";

interface SidebarProps {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ open, conversations, activeId, onSelect, onNew, onDelete }: SidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={`flex h-full overflow-hidden border-r border-zinc-800 bg-zinc-950 transition-all duration-200 ease-in-out ${
        open ? "w-72" : "w-0 border-r-0"
      }`}
    >
      <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <Sparkles className="h-5 w-5 text-violet-400" />
        <h1 className="text-lg font-semibold text-white">SK-AI</h1>
      </div>

      <div className="px-3">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-300 placeholder-zinc-500 outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {search ? "No matches found" : "No conversations yet"}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((conv) => (
              <li key={conv.id} className="group relative">
                <button
                  onClick={() => onSelect(conv.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    activeId === conv.id
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{conv.title}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-600">Demo Mode — No auth required</p>
      </div>
      </div>
    </aside>
  );
}
