import { converter, anyOf, byMime, byExt } from "../converter.js";
import { htmlToMarkdown } from "../transforms/html-to-markdown.js";
import mammoth from "mammoth";

const ACCEPTED_EXTENSIONS = [".docx"];
const ACCEPTED_MIME_PREFIXES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const docxConverter = converter(
  "DOCX",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const result = await mammoth.convertToHtml(
      { buffer: ctx.buffer },
      { styleMap: ctx.opts.styleMap ? [ctx.opts.styleMap] : undefined },
    );
    const { markdown, title } = htmlToMarkdown(result.value, ctx.opts);
    return { markdown, title };
  },
);
