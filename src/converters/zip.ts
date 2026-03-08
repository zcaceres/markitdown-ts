import path from "node:path";
import type { Converter, ConverterContext } from "../converter.js";
import { anyOf, byMime, byExt } from "../converter.js";
import type { ConvertResult, StreamInfo } from "../types.js";
import {
  UnsupportedFormatError,
  FileConversionError,
} from "../exceptions.js";

const ACCEPTED_EXTENSIONS = [".zip"];
const ACCEPTED_MIME_PREFIXES = ["application/zip"];

const matcher = anyOf(
  byExt(...ACCEPTED_EXTENSIONS),
  byMime(...ACCEPTED_MIME_PREFIXES),
);

type ConvertBufferFn = (
  buffer: Buffer,
  input?: { streamInfo?: StreamInfo },
) => Promise<ConvertResult>;

export function createZipConverter(convertFn: ConvertBufferFn): Converter {
  return {
    name: "ZIP",
    match: (ctx: ConverterContext) => matcher(ctx),
    async convert(ctx: ConverterContext) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(ctx.buffer);

      const filePath =
        ctx.info.url || ctx.info.localPath || ctx.info.filename || "archive.zip";
      let md = `Content from the zip file \`${filePath}\`:\n\n`;

      for (const name of Object.keys(zip.files)) {
        const entry = zip.files[name];
        if (entry.dir) continue;

        try {
          const data = await entry.async("nodebuffer");
          const ext = path.extname(name);
          const filename = path.basename(name);

          const result = await convertFn(Buffer.from(data), {
            streamInfo: {
              extension: ext || undefined,
              filename,
            },
          });

          md += `## File: ${name}\n\n`;
          md += result.markdown + "\n\n";
        } catch (e) {
          if (
            e instanceof UnsupportedFormatError ||
            e instanceof FileConversionError
          ) {
            // Skip files we can't convert
            continue;
          }
          // Re-throw unexpected errors
          throw e;
        }
      }

      return { markdown: md.trim() };
    },
  };
}
