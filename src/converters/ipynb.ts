import { anyOf, byExt, converter } from "../converter.js";
import { FileConversionError } from "../exceptions.js";
import { decodeBuffer } from "../transforms/decode-text.js";

const ACCEPTED_EXTENSIONS = [".ipynb"];

function looksLikeNotebook(buffer: Buffer, charset?: string): boolean {
  try {
    const text = decodeBuffer(buffer, charset ?? "utf-8");
    return text.includes("nbformat") && text.includes("nbformat_minor");
  } catch {
    return false;
  }
}

export const ipynbConverter = converter(
  "Ipynb",
  anyOf(
    byExt(...ACCEPTED_EXTENSIONS),
    // For application/json, also check if content looks like a notebook
    (ctx) => {
      const mime = (ctx.info.mimetype ?? "").toLowerCase();
      if (!mime.startsWith("application/json")) return false;
      return looksLikeNotebook(ctx.buffer, ctx.info.charset);
    },
  ),
  async (ctx) => {
    try {
      const text = decodeBuffer(ctx.buffer, ctx.info.charset ?? "utf-8");
      const notebook = JSON.parse(text);
      const mdOutput: string[] = [];
      let title: string | undefined;

      for (const cell of notebook.cells ?? []) {
        const cellType: string = cell.cell_type ?? "";
        const sourceLines: string[] = cell.source ?? [];
        const source = sourceLines.join("");

        if (cellType === "markdown") {
          mdOutput.push(source);
          if (title === undefined) {
            for (const line of sourceLines) {
              if (line.startsWith("# ")) {
                title = line.replace(/^#+\s*/, "").trim();
                break;
              }
            }
          }
        } else if (cellType === "code") {
          mdOutput.push(`\`\`\`python\n${source}\n\`\`\``);
        } else if (cellType === "raw") {
          mdOutput.push(`\`\`\`\n${source}\n\`\`\``);
        }
      }

      const mdText = mdOutput.join("\n\n");
      // Check for title in notebook metadata
      const metadataTitle = notebook.metadata?.title;
      if (metadataTitle) {
        title = metadataTitle;
      }

      return { markdown: mdText, title };
    } catch (e) {
      throw new FileConversionError(`Error converting .ipynb file: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
);
