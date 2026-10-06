import { createServerFn } from "@tanstack/react-start";

const DEMO_RESPONSES: Record<string, string> = {
  default:
    "This is a simulated AI response for the SK-AI demo. In production, this would stream from the OpenRouter API. The response would include **markdown formatting**, code blocks, and other rich content.\n\n```typescript\nconst response = await openRouter.chat.send({\n  model: 'openai/gpt-4o',\n  messages: [{ role: 'user', content: prompt }],\n  stream: true,\n});\n```\n\nFor now, enjoy exploring the UI!",
  greeting:
    "Hello! I'm SK-AI, your AI assistant. I can help you with:\n\n- **Writing & Editing** — drafts, emails, code\n- **Analysis** — data, documents, reasoning\n- **Coding** — debugging, architecture, reviews\n- **Learning** — explanations, tutorials, summaries\n\nHow can I help you today?",
  code: "Here's an example of how the SK-AI API integration works:\n\n```typescript\nasync function streamChat(prompt: string, model: string) {\n  const response = await fetch('/api/chat', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ prompt, model }),\n  });\n\n  const reader = response.body?.getReader();\n  if (!reader) throw new Error('No stream');\n\n  while (true) {\n    const { done, value } = await reader.read();\n    if (done) break;\n    const chunk = new TextDecoder().decode(value);\n    // Process SSE chunks...\n  }\n}\n```\n\nThis demonstrates the streaming pattern used in production.",
};

export const sendChatMessage = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const lower = data.message.toLowerCase();
    let response: string;

    if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
      response = DEMO_RESPONSES.greeting;
    } else if (lower.includes("code") || lower.includes("function") || lower.includes("api")) {
      response = DEMO_RESPONSES.code;
    } else {
      response = DEMO_RESPONSES.default;
    }

    return { response, model: data.model };
  });
