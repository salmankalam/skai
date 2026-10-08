import { useState, useRef, useEffect } from "react";
import { ArrowUp, Paperclip, X, FileText, FileIcon, ImageIcon } from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { formatFileSize, MAX_FILE_SIZE } from "../lib/files";
import { DAILY_MESSAGE_LIMIT, FILE_DAILY_LIMIT } from "../lib/limits";
import type { FileAttachment, ModelOption } from "../lib/types";

interface ChatInputProps {
  model: string;
  onModelChange: (model: string) => void;
  onSend: (message: string) => void;
  attachments: FileAttachment[];
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  error: string | null;
  onDismissError: () => void;
  disabled?: boolean;
  models: ModelOption[];
  mode: "text" | "file";
}

function AttachmentIcon({ kind }: { kind: FileAttachment["kind"] }) {
  if (kind === "image") return <ImageIcon className="h-3 w-3 text-violet-400" />;
  if (kind === "pdf") return <FileIcon className="h-3 w-3 text-red-400" />;
  return <FileText className="h-3 w-3 text-zinc-400" />;
}

export function ChatInput({
  model,
  onModelChange,
  onSend,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  error,
  onDismissError,
  disabled,
  models,
  mode,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileTipOpen, setFileTipOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const pickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onAddFiles(Array.from(files));
  };

  const hasPdf = attachments.some((a) => a.kind === "pdf");

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl">
        {error && (
          <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/60 px-3 py-2 text-xs text-red-300">
            <span className="break-words">{error}</span>
            <button
              onClick={onDismissError}
              aria-label="Dismiss error"
              className="shrink-0 rounded p-0.5 text-red-400 hover:text-red-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!disabled) pickFiles(e.dataTransfer.files);
          }}
          className={`rounded-2xl border bg-zinc-900 p-2 transition-colors ${
            dragOver ? "border-violet-500 ring-1 ring-violet-500/50" : "border-zinc-700"
          }`}
        >
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex max-w-[200px] items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 py-1 pl-2 pr-1 text-[11px] text-zinc-300"
                >
                  <AttachmentIcon kind={att.kind} />
                  <span className="truncate">{att.filename}</span>
                  <span className="shrink-0 text-zinc-500">{formatFileSize(att.size)}</span>
                  <button
                    onClick={() => onRemoveAttachment(att.id)}
                    aria-label={`Remove ${att.filename}`}
                    className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <ModelSelector value={model} onChange={onModelChange} models={models} mode={mode} />
            <div className="relative">
              <button
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setFileTipOpen(true)}
                onMouseLeave={() => setFileTipOpen(false)}
                onFocus={() => setFileTipOpen(true)}
                onBlur={() => setFileTipOpen(false)}
                disabled={disabled}
                aria-label="Attach files"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <div
                role="tooltip"
                className={`absolute bottom-full left-1/2 z-50 mb-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-left shadow-xl shadow-black/40 transition-all ease-out ${
                  fileTipOpen
                    ? "translate-y-0 scale-100 opacity-100 delay-0 duration-200"
                    : "pointer-events-none translate-y-1 scale-95 opacity-0 delay-150 duration-150"
                }`}
              >
                <p className="text-sm font-semibold text-zinc-200">Drop any file here</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
                  Text &amp; code (.txt, .md, .json, .py, .js), images (.png, .jpg, .webp) or
                  PDF (.pdf) — or drag &amp; drop straight into the box.
                </p>
                <p className="mt-1.5 text-[13px] text-zinc-500">
                  Up to {MAX_FILE_SIZE / 1024 / 1024} MB per file.
                </p>
                <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-zinc-700 bg-zinc-900" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,.log,.xml,.yaml,.yml,.toml,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.go,.rs,.rb,.php,.sh,.sql,.html,.css"
              className="hidden"
              onChange={(e) => {
                pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message SK-AI... (drop files here)"
              rows={1}
              disabled={disabled}
              className="max-h-[200px] min-h-[32px] min-w-[12rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mode === "file" && (
          <p className="mt-2 text-center text-[11px] text-amber-500/80">
            File task — your files are answered by OpenRouter&apos;s free models ({FILE_DAILY_LIMIT}
            /day). Pick one from the selector.{" "}
            {hasPdf && "PDFs are parsed with the free Cloudflare AI engine."}
          </p>
        )}

        <p className="mt-2 text-center text-[11px] text-zinc-600">
          SK-AI can make mistakes. Review responses carefully. · {DAILY_MESSAGE_LIMIT} free
          messages/day · {FILE_DAILY_LIMIT} file requests/day
        </p>
      </div>
    </div>
  );
}
