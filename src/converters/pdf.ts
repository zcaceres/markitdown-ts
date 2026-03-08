import { converter, anyOf, byMime, byExt } from "../converter.js";

const ACCEPTED_EXTENSIONS = [".pdf"];
const ACCEPTED_MIME_PREFIXES = ["application/pdf", "application/x-pdf"];

export const pdfConverter = converter(
  "PDF",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse(new Uint8Array(ctx.buffer));
    await parser.load();
    const result = await parser.getText();
    return { markdown: result.text };
  },
);
