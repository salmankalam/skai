import { Sparkles, Code, BookOpen, Lightbulb, Zap } from "lucide-react";
import { DAILY_MESSAGE_LIMIT, type DailyUsage } from "../lib/limits";

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
  usage: DailyUsage | null;
}

const SUGGESTIONS = [
  { icon: Code, label: "Write code", prompt: "Help me write a React component" },
  { icon: BookOpen, label: "Explain a topic", prompt: "Explain how Cloudflare Workers work" },
  { icon: Lightbulb, label: "Brainstorm ideas", prompt: "Give me project ideas for a chat app" },
];

export function WelcomeScreen({ onPromptClick, usage }: WelcomeScreenProps) {
  const usageText =
    usage === null ? (
      <>
        Free plan · <span className="font-medium text-zinc-300">{DAILY_MESSAGE_LIMIT} messages</span> per day
      </>
    ) : usage.remaining > 0 ? (
      <>
        Free plan ·{" "}
        <span className="font-medium text-zinc-300">
          {usage.remaining} of {usage.limit}
        </span>{" "}
        messages left today
      </>
    ) : (
      <span className="text-amber-500">
        Daily limit reached ({usage.limit}/day) — resets at midnight UTC
      </span>
    );

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

        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-500">
          <Zap className="h-3.5 w-3.5 text-violet-400" />
          {usageText}
        </div>
      </div>
    </div>
  );
}
