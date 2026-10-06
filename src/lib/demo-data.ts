import type { Conversation } from "./types";

export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "demo-1",
    title: "Getting Started with SK-AI",
    model: "openai/gpt-4o-mini",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86000000,
    messages: [
      {
        id: "msg-1a",
        role: "user",
        content: "What is SK-AI and how do I use it?",
        timestamp: Date.now() - 86400000,
      },
      {
        id: "msg-1b",
        role: "assistant",
        content: "SK-AI is a modern chatbot interface that connects to multiple AI models through OpenRouter. Here's how to get started:\n\n1. **Select a model** from the dropdown in the chat input\n2. **Type your message** and press Enter or click Send\n3. **Create new conversations** using the sidebar\n4. **Switch between models** anytime — each conversation remembers its model\n\nYour conversations are automatically saved and stored securely.",
        timestamp: Date.now() - 86300000,
      },
      {
        id: "msg-1c",
        role: "user",
        content: "Can I use different models in different conversations?",
        timestamp: Date.now() - 86200000,
      },
      {
        id: "msg-1d",
        role: "assistant",
        content: "Absolutely! Each conversation in SK-AI can use a different AI model. When you start a new conversation, it will use your default model, but you can switch models at any time using the dropdown selector in the chat input area.\n\nThis is useful for:\n- Comparing responses across models\n- Using faster models for simple tasks\n- Switching to more capable models for complex reasoning",
        timestamp: Date.now() - 86100000,
      },
    ],
  },
  {
    id: "demo-2",
    title: "React Performance Tips",
    model: "anthropic/claude-sonnet-4",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172000000,
    messages: [
      {
        id: "msg-2a",
        role: "user",
        content: "What are the best practices for React performance optimization?",
        timestamp: Date.now() - 172800000,
      },
      {
        id: "msg-2b",
        role: "assistant",
        content: "Here are key React performance optimization techniques:\n\n## Memoization\n- Use `React.memo()` for expensive components\n- Use `useMemo()` for costly calculations\n- Use `useCallback()` for stable function references\n\n## Code Splitting\n- Lazy load routes with `React.lazy()`\n- Use dynamic imports for heavy dependencies\n\n## State Management\n- Keep state as local as possible\n- Use context sparingly — it triggers re-renders\n- Consider state libraries like Zustand for global state\n\n## Virtualization\n- Use `react-window` or `@tanstack/react-virtual` for long lists\n- Only render visible items\n\n## Bundle Analysis\n- Run `webpack-bundle-analyzer` regularly\n- Remove unused dependencies",
        timestamp: Date.now() - 172700000,
      },
    ],
  },
  {
    id: "demo-3",
    title: "Cloudflare Workers Guide",
    model: "openai/gpt-4o",
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 259000000,
    messages: [
      {
        id: "msg-3a",
        role: "user",
        content: "How do I deploy a TanStack Start app to Cloudflare Workers?",
        timestamp: Date.now() - 259200000,
      },
      {
        id: "msg-3b",
        role: "assistant",
        content: "Deploying TanStack Start to Cloudflare Workers is straightforward:\n\n## Prerequisites\n- A Cloudflare account\n- Wrangler CLI installed (`npm i -g wrangler`)\n\n## Steps\n\n1. **Install the Cloudflare Vite plugin:**\n   ```bash\n   npm install @cloudflare/vite-plugin\n   ```\n\n2. **Configure `vite.config.ts`:**\n   Add the `cloudflare()` plugin to your Vite config.\n\n3. **Set up Wrangler:**\n   Create a `wrangler.jsonc` file with your account ID and bindings.\n\n4. **Deploy:**\n   ```bash\n   npx wrangler deploy\n   ```\n\n## Key Bindings\n- **KV** — for conversation storage\n- **D1** — for relational data (if needed later)\n- **Secrets** — store your OpenRouter API key here",
        timestamp: Date.now() - 259100000,
      },
    ],
  },
];
