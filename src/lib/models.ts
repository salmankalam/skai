import type { ModelOption, ProviderRoute } from "./types";

/**
 * FREE models only — never add paid models anywhere.
 *
 * APInex free-tier models for text chat. Ids from GET https://apinex.bond/api/public/models
 * (provider "Free", dollarsPer1M = 0) and verified live 2026-10-10. Models
 * ranked below Mimo V2.6 Pro are gated behind a subscription (402) and are
 * intentionally excluded.
 */
export const APINEX_FREE_MODELS: ModelOption[] = [
  {
    id: "free/qwen-3.8-max",
    name: "Qwen 3.8 MAX",
    provider: "APInex",
    route: "apinex",
    description: "Flagship free model — strong reasoning",
    vision: false,
  },
  {
    id: "free/deepseek-v4.1-flash",
    name: "Deepseek V4.1 Flash",
    provider: "APInex",
    route: "apinex",
    description: "Fast free DeepSeek",
    vision: false,
  },
  {
    id: "free/deepseek-v4-flash-0731",
    name: "Deepseek V4 Flash",
    provider: "APInex",
    route: "apinex",
    description: "Free DeepSeek flash",
    vision: false,
  },
  {
    id: "free/deepseek-v4-pro-0813",
    name: "Deepseek V4 Pro",
    provider: "APInex",
    route: "apinex",
    description: "Free DeepSeek pro",
    vision: false,
  },
  {
    id: "free/gpt-6-luna",
    name: "GPT 6 Luna",
    provider: "APInex",
    route: "apinex",
    description: "Free GPT-6 class model",
    vision: false,
  },
  {
    id: "free/glm-5.3-flash",
    name: "GLM-5.3 Flash",
    provider: "APInex",
    route: "apinex",
    description: "Fast free GLM flash",
    vision: false,
  },
  {
    id: "free/mimo-v2.6-pro",
    name: "Mimo V2.6 Pro",
    provider: "APInex",
    route: "apinex",
    description: "Free Mimo pro",
    vision: false,
  },
];

// ——— NaraRouter (commented out 2026-10-10; APInex replaced it) ———
// To re-enable: uncomment the array + the two ALL_MODELS/TEXT_MODELS
// references below, add "nara" back to ProviderRoute, and restore the
// nara quota branch in src/server/chat.ts.
//
// export const NARA_FREE_MODELS: ModelOption[] = [
//   { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash", provider: "NaraRouter", route: "nara", description: "Fast free model for everyday chat", vision: true },
//   { id: "laguna-s-2.1", name: "Laguna S 2.1", provider: "NaraRouter", route: "nara", description: "Free NaraRouter model", vision: false },
//   { id: "ling-3.0-flash-sante-free", name: "Ling 3.0 Flash Sante", provider: "NaraRouter", route: "nara", description: "Free Ling flash model", vision: false },
//   { id: "nemotron-3-super-free", name: "Nemotron 3 Super Free", provider: "NaraRouter", route: "nara", description: "Free Nemotron — multimodal reasoning", vision: true },
//   { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free", provider: "NaraRouter", route: "nara", description: "Free Nemotron — multimodal reasoning", vision: true },
//   { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning", provider: "NaraRouter", route: "nara", description: "Free Nemotron — fast multimodal", vision: true },
// ];

/**
 * OpenRouter free multimodal models — the ONLY models allowed for
 * file-based tasks (images, PDFs, text files). Verified against
 * https://openrouter.ai/api/v1/models (pricing.prompt === "0").
 */
export const OPENROUTER_FILE_MODELS: ModelOption[] = [
  {
    id: "openrouter/free",
    name: "Free Router",
    provider: "OpenRouter",
    route: "openrouter",
    description: "Auto-picks a free model that fits your request",
    vision: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    provider: "OpenRouter",
    route: "openrouter",
    description: "Multimodal — text, images, video. 262K context",
    vision: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Gemma 4 26B MoE",
    provider: "OpenRouter",
    route: "openrouter",
    description: "Fast multimodal mixture-of-experts. 262K context",
    vision: true,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "Nemotron 3 Nano Omni",
    provider: "OpenRouter",
    route: "openrouter",
    description: "Reasoning across text, image, video, audio. 256K",
    vision: true,
  },
];

export const ALL_MODELS: ModelOption[] = [
  ...APINEX_FREE_MODELS,
  // ...NARA_FREE_MODELS, // commented out 2026-10-10 — see note above
  ...OPENROUTER_FILE_MODELS,
];

export const TEXT_MODELS = APINEX_FREE_MODELS;
export const FILE_MODELS = OPENROUTER_FILE_MODELS;

export const DEFAULT_MODEL = APINEX_FREE_MODELS[0].id;
export const FILE_DEFAULT_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

export function isFreeModel(id: string): boolean {
  return ALL_MODELS.some((m) => m.id === id);
}

export function getRoute(id: string): ProviderRoute | null {
  return ALL_MODELS.find((m) => m.id === id)?.route ?? null;
}

export function getModel(id: string): ModelOption {
  return ALL_MODELS.find((m) => m.id === id) ?? ALL_MODELS[0];
}
