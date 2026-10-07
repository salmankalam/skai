import { useState, useRef, useEffect } from "react";
import { ArrowUp, Paperclip, X, FileText, FileIcon, ImageIcon } from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { formatFileSize, MAX_FILE_SIZE } from "../lib/files";
import { getModel, VISION_FALLBACK_MODEL, hasVision } from "../lib/models";
import type { FileAttachment } from "../lib/types";

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
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
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

  const hasImage = attachments.some((a) => a.kind === "image");
  const hasPdf = attachments.some((a) => a.kind === "pdf");
  const visionFallback = hasImage && !hasVision(model);

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-4">
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

          <div className="flex items-end gap-2">
            <ModelSelector value={model} onChange={onModelChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              aria-label="Attach files"
              title={`Attach files — images, PDF, text/code (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>
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
              className="max-h-[200px] min-h-[32px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none disabled:opacity-50"
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

        {(visionFallback || hasPdf) && (
          <p className="mt-2 text-center text-[11px] text-amber-500/80">
            {visionFallback &&
              `Image attached — ${getModel(VISION_FALLBACK_MODEL).name} (free) will answer this message. `}
            {hasPdf && "PDFs are parsed with the free Cloudflare AI engine."}
          </p>
        )}

        <p className="mt-2 text-center text-[11px] text-zinc-600">
          SK-AI can make mistakes. Review responses carefully.
        </p>
      </div>
    </div>
  );
}
