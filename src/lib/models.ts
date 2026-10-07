import type { ModelOption } from "./types";

/**
 * Free models only — every id either ends in `:free` or is OpenRouter's
 * free-models router. Verified against https://openrouter.ai/api/v1/models
 * (pricing.prompt === "0"). Never add paid models here.
 */
export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "openrouter/free",
    name: "Free Router",
    provider: "OpenRouter",
    description: "Auto-picks a free model that fits your request",
    vision: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    provider: "Google",
    description: "Multimodal — text, images, video. 262K context",
    vision: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Gemma 4 26B MoE",
    provider: "Google",
    description: "Fast multimodal mixture-of-experts. 262K context",
    vision: true,
  },
  {
    id: "thinkingmachines/inkling:free",
    name: "Inkling",
    provider: "Thinking Machines",
    description: "Vision + audio input. 1M context",
    vision: true,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "Nemotron 3 Nano Omni",
    provider: "NVIDIA",
    description: "Reasoning across text, image, video, audio. 256K",
    vision: true,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    provider: "NVIDIA",
    description: "Frontier open model. 1M context",
    vision: false,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super",
    provider: "NVIDIA",
    description: "Strong general purpose. 262K context",
    vision: false,
  },
  {
    id: "cohere/north-mini-code:free",
    name: "North Mini Code",
    provider: "Cohere",
    description: "Code-focused assistant. 256K context",
    vision: false,
  },
];

export const DEFAULT_MODEL = "google/gemma-4-31b-it:free";

export const VISION_FALLBACK_MODEL = "google/gemma-4-31b-it:free";

export function isFreeModel(id: string): boolean {
  return AVAILABLE_MODELS.some((m) => m.id === id);
}

export function hasVision(id: string): boolean {
  return AVAILABLE_MODELS.find((m) => m.id === id)?.vision ?? false;
}

export function getModel(id: string): ModelOption {
  return AVAILABLE_MODELS.find((m) => m.id === id) ?? AVAILABLE_MODELS[1];
}
