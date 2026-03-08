import type { StreamInfo } from "./types.js";

/**
 * Merge multiple StreamInfo objects. Later values override earlier ones,
 * but only for non-undefined fields.
 */
export function mergeStreamInfo(
  base: StreamInfo,
  ...overrides: (StreamInfo | undefined)[]
): StreamInfo {
  const result = { ...base };
  for (const override of overrides) {
    if (!override) continue;
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        (result as any)[key] = value;
      }
    }
  }
  return result;
}

/**
 * Guess mimetype from extension using a built-in lookup table.
 */
export function guessMimeFromExtension(ext: string): string | undefined {
  const map: Record<string, string> = {
    ".txt": "text/plain",
    ".text": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".html": "text/html",
    ".htm": "text/html",
    ".json": "application/json",
    ".jsonl": "application/jsonl",
    ".csv": "text/csv",
    ".xml": "text/xml",
    ".pdf": "application/pdf",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".epub": "application/epub+zip",
    ".zip": "application/zip",
    ".ipynb": "application/x-ipynb+json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".msg": "application/vnd.ms-outlook",
    ".rss": "application/rss+xml",
    ".atom": "application/atom+xml",
  };
  return map[ext.toLowerCase()];
}

/**
 * Guess extension from mimetype.
 */
export function guessExtensionFromMime(mime: string): string | undefined {
  const map: Record<string, string> = {
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/html": ".html",
    "application/json": ".json",
    "text/csv": ".csv",
    "text/xml": ".xml",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      ".pptx",
    "application/epub+zip": ".epub",
    "application/zip": ".zip",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "audio/mpeg": ".mp3",
    "application/vnd.ms-outlook": ".msg",
  };
  return map[mime.toLowerCase()];
}
