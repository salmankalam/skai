import { Sparkles, Code, BookOpen, Lightbulb } from "lucide-react";

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const SUGGESTIONS = [
  { icon: Code, label: "Write code", prompt: "Help me write a React component" },
  { icon: BookOpen, label: "Explain a topic", prompt: "Explain how Cloudflare Workers work" },
  { icon: Lightbulb, label: "Brainstorm ideas", prompt: "Give me project ideas for a chat app" },
];

export function WelcomeScreen({ onPromptClick }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/20">
          <Sparkles className="h-8 w-8 text-violet-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white">Welcome to SK-AI</h2>
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
      </div>
    </div>
  );
}
