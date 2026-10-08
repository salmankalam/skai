import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { ModelOption } from "../lib/types";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  models: ModelOption[];
  mode: "text" | "file";
}

function ModelRow({
  model,
  value,
  onPick,
}: {
  model: ModelOption;
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onPick(model.id)}
      className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-800"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{model.name}</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
            {model.provider}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">{model.description}</p>
      </div>
      {value === model.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />}
    </button>
  );
}

export function ModelSelector({ value, onChange, models, mode }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = models.find((m) => m.id === value) ?? models[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const naraModels = models.filter((m) => m.route === "nara");
  const openRouterModels = models.filter((m) => m.route === "openrouter");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600"
      >
        <span className="text-violet-400">{selected.provider}</span>
        <span className="text-zinc-500">/</span>
        <span>{selected.name}</span>
        <ChevronDown className="h-3 w-3 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl shadow-black/40">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {mode === "file" ? "File task — models that support files" : "Select Model"}
          </p>

          {mode === "file" ? (
            <div className="max-h-80 overflow-y-auto">
              {openRouterModels.map((model) => (
                <ModelRow key={model.id} model={model} value={value} onPick={pick} />
              ))}
            </div>
          ) : (
            <>
              {naraModels.length > 0 && (
                <div>
                  <p className="border-t border-zinc-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                    NaraRouter — text chat
                  </p>
                  {/* ~3 rows visible; scroll for the rest */}
                  <div className="max-h-[10.25rem] overflow-y-auto">
                    {naraModels.map((model) => (
                      <ModelRow key={model.id} model={model} value={value} onPick={pick} />
                    ))}
                  </div>
                </div>
              )}
              {openRouterModels.length > 0 && (
                <div>
                  <p className="border-t border-zinc-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                    OpenRouter — 5 requests/day
                  </p>
                  {/* ~3 rows visible; scroll for the rest */}
                  <div className="max-h-[10.25rem] overflow-y-auto">
                    {openRouterModels.map((model) => (
                      <ModelRow key={model.id} model={model} value={value} onPick={pick} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
