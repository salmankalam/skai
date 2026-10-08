import { Sparkles, Code, BookOpen, Lightbulb, Zap } from "lucide-react";
import { FILE_DAILY_LIMIT, type DailyUsage } from "../lib/limits";

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
  usage: DailyUsage | null;
  fileMode: boolean;
}

const SUGGESTIONS = [
  { icon: Code, label: "Write code", prompt: "Help me write a React component" },
  { icon: BookOpen, label: "Explain a topic", prompt: "Explain how Cloudflare Workers work" },
  { icon: Lightbulb, label: "Brainstorm ideas", prompt: "Give me project ideas for a chat app" },
];

export function WelcomeScreen({ onPromptClick, usage, fileMode }: WelcomeScreenProps) {
  let usageText: React.ReactNode = null;

  if (usage?.fileExhausted) {
    usageText = (
      <span className="text-amber-500">
        OpenRouter quota reached — free requests used up by all users; file tasks disabled until
        midnight UTC
      </span>
    );
  } else if (fileMode) {
    usageText = !usage ? (
      <>
        File tasks · <span className="font-medium text-zinc-300">{FILE_DAILY_LIMIT} requests</span>{" "}
        per day
      </>
    ) : usage.file.remaining > 0 ? (
      <>
        File tasks ·{" "}
        <span className="font-medium text-zinc-300">
          {usage.file.remaining} of {usage.file.limit}
        </span>{" "}
        file requests left today
      </>
    ) : (
      <span className="text-amber-500">
        File limit reached ({usage.file.limit}/day) — resets at midnight UTC
      </span>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/20">
          <Sparkles className="h-8 w-8 text-violet-400" />
        </div>
        <h2 className="text-xl font-semibold text-white sm:text-2xl">Welcome to SK-AI</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Your AI assistant powered by multiple models. Select a model below and start chatting.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => onPromptClick(prompt)}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300 transition-colors hover:border-violet-500/50 hover:bg-zinc-800"
            >
              <Icon className="h-5 w-5 text-violet-400" />
              {label}
            </button>
          ))}
        </div>

        {usageText !== null && (
          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-500">
            <Zap className="h-3.5 w-3.5 text-violet-400" />
            {usageText}
          </div>
        )}
      </div>
    </div>
  );
}
