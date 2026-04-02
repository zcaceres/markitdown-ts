import { anyOf, byExt, byMime, converter } from "../converter.js";
import { decodeBuffer } from "../transforms/decode-text.js";
import { htmlToMarkdown } from "../transforms/html-to-markdown.js";

const ACCEPTED_EXTENSIONS = [".html", ".htm"];
const ACCEPTED_MIME_PREFIXES = ["text/html", "application/xhtml"];

export const htmlConverter = converter(
  "HTML",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const encoding = ctx.info.charset ?? "utf-8";
    const html = decodeBuffer(ctx.buffer, encoding);
    const { markdown, title } = htmlToMarkdown(html, ctx.opts);
    return { markdown, title };
  },
);
