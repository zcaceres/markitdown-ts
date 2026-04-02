import { anyOf, byExt, byMime, converter, hasCharset } from "../converter.js";
import { decodeBuffer } from "../transforms/decode-text.js";

const ACCEPTED_EXTENSIONS = [".txt", ".text", ".md", ".markdown", ".json", ".jsonl"];
const ACCEPTED_MIME_PREFIXES = ["text/", "application/json", "application/markdown"];

export const plainTextConverter = converter(
  "PlainText",
  anyOf(hasCharset(), byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const text = decodeBuffer(ctx.buffer, ctx.info.charset);
    return { markdown: text };
  },
);
