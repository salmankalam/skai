import type { FileAttachment } from "./types";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (keeps Workers CPU use low)
export const MAX_TEXT_INJECT_CHARS = 40_000;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const PDF_TYPES = ["application/pdf"];
const PDF_EXTS = ["pdf"];
const TEXT_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tsv",
  "text/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
];
const TEXT_EXTS = [
  "txt", "md", "markdown", "csv", "tsv", "json", "log", "xml", "yaml", "yml", "toml",
  "ini", "conf", "cfg", "env", "sql", "sh", "bash", "zsh", "ps1", "bat",
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt",
  "c", "cc", "cpp", "h", "hpp", "cs", "php", "swift", "dart", "r", "lua", "pl",
  "html", "css", "scss", "less", "vue", "svelte", "astro", "dockerfile", "gitignore",
  "lock", "ipynb", "gradle", "cmake", "properties", "editorconfig",
];

function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export function detectKind(filename: string, contentType: string): FileAttachment["kind"] | null {
  const ext = extOf(filename);
  const ct = contentType.toLowerCase();

  if (IMAGE_TYPES.includes(ct) || IMAGE_EXTS.includes(ext)) return "image";
  if (PDF_TYPES.includes(ct) || PDF_EXTS.includes(ext)) return "pdf";
  if (ct.startsWith("text/") || TEXT_TYPES.includes(ct) || TEXT_EXTS.includes(ext)) return "text";
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
