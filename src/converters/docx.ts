import { converter, anyOf, byMime, byExt } from "../converter.js";
import { htmlToMarkdown } from "../transforms/html-to-markdown.js";
import mammoth from "mammoth";
import { preProcessDocx } from "../converter-utils/docx/pre-process.js";

const ACCEPTED_EXTENSIONS = [".docx"];
const ACCEPTED_MIME_PREFIXES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const docxConverter = converter(
  "DOCX",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    // Pre-process: convert OMML math equations to LaTeX
    let buffer: Buffer;
    try {
      buffer = await preProcessDocx(ctx.buffer);
    } catch {
      // If pre-processing fails, use original buffer
      buffer = ctx.buffer;
    }

    const result = await mammoth.convertToHtml(
      { buffer },
      { styleMap: ctx.opts.styleMap ? [ctx.opts.styleMap] : undefined },
    );
    const { markdown, title } = htmlToMarkdown(result.value, ctx.opts);
    return { markdown, title };
  },
);
