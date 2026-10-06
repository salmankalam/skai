import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { ModelSelector } from "./ModelSelector";

interface ChatInputProps {
  model: string;
  onModelChange: (model: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ model, onModelChange, onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 p-2">
          <ModelSelector value={model} onChange={onModelChange} />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message SK-AI..."
            rows={1}
            disabled={disabled}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-600">
          SK-AI can make mistakes. Review responses carefully.
        </p>
      </div>
    </div>
  );
}
