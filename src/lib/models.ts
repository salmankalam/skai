import type { ModelOption, ProviderRoute } from "./types";

/**
 * FREE models only — never add paid models anywhere.
 *
 * NaraRouter free-tier models for text chat. Aliases below are best-effort
 * slugs of the published free plan (Agnes 2.5 Flash, Agnes 3 Flash, Exo
 * Stealth, Jev, Laguna S 2.1). Verify the real ids with
 * `npm run models:check` once NARA_API_KEY is set (probes GET /v1/models).
 */
export const NARA_FREE_MODELS: ModelOption[] = [
  {
    id: "agnes-2.5-flash",
    name: "Agnes 2.5 Flash",
    provider: "NaraRouter",
    route: "nara",
    description: "Fast free model for everyday chat",
    vision: false,
  },
  {
    id: "agnes-3-flash",
    name: "Agnes 3 Flash",
    provider: "NaraRouter",
    route: "nara",
    description: "Newest Agnes — quick, free responses",
    vision: false,
  },
  {
    id: "exo-stealth",
    name: "Exo Stealth",
    provider: "NaraRouter",
    route: "nara",
    description: "Free NaraRouter model",
    vision: false,
  },
  {
    id: "jev",
    name: "Jev",
    provider: "NaraRouter",
    route: "nara",
    description: "Free NaraRouter model",
    vision: false,
  },
  {
    id: "laguna-s-2.1",
    name: "Laguna S 2.1",
    provider: "NaraRouter",
    route: "nara",
    description: "Free NaraRouter model",
    vision: false,
  },
];

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
    id: "thinkingmachines/inkling:free",
    name: "Inkling",
    provider: "OpenRouter",
    route: "openrouter",
    description: "Vision + audio input. 1M context",
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

export const ALL_MODELS: ModelOption[] = [...NARA_FREE_MODELS, ...OPENROUTER_FILE_MODELS];

export const TEXT_MODELS = NARA_FREE_MODELS;
export const FILE_MODELS = OPENROUTER_FILE_MODELS;

export const DEFAULT_MODEL = NARA_FREE_MODELS[0].id;
export const FILE_DEFAULT_MODEL = "google/gemma-4-31b-it:free";

export function isFreeModel(id: string): boolean {
  return ALL_MODELS.some((m) => m.id === id);
}

export function getRoute(id: string): ProviderRoute | null {
  return ALL_MODELS.find((m) => m.id === id)?.route ?? null;
}

export function getModel(id: string): ModelOption {
  return ALL_MODELS.find((m) => m.id === id) ?? ALL_MODELS[0];
}
