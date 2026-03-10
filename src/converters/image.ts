import { converter, anyOf, byMime, byExt } from "../converter.js";
import { exiftoolMetadata } from "./exiftool.js";

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const ACCEPTED_MIME_PREFIXES = ["image/jpeg", "image/png"];

const IMAGE_METADATA_FIELDS = [
  "ImageSize",
  "Title",
  "Caption",
  "Description",
  "Keywords",
  "Artist",
  "Author",
  "DateTimeOriginal",
  "CreateDate",
  "GPSPosition",
];

export const imageConverter = converter(
  "Image",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    let md = "";

    // Extract metadata via exiftool
    const metadata = await exiftoolMetadata(ctx.buffer, ctx.opts.exiftoolPath);
    for (const field of IMAGE_METADATA_FIELDS) {
      if (metadata[field]) {
        md += `${field}: ${metadata[field]}\n`;
      }
    }

    // Optional LLM description
    if (ctx.opts.llmClient && ctx.opts.llmModel) {
      const extMimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
      };
      const contentType =
        ctx.info.mimetype ||
        (ctx.info.extension ? extMimeMap[ctx.info.extension] : undefined) ||
        "application/octet-stream";
      const base64Image = ctx.buffer.toString("base64");
      const dataUri = `data:${contentType};base64,${base64Image}`;
      const prompt =
        ctx.opts.llmPrompt?.trim() || "Write a detailed caption for this image.";

      try {
        const response = await ctx.opts.llmClient.chat.completions.create({
          model: ctx.opts.llmModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUri } },
              ],
            },
          ],
        });
        const description = response.choices?.[0]?.message?.content;
        if (description) {
          md += "\n# Description:\n" + description.trim() + "\n";
        }
      } catch {
        // LLM call failed — continue without description
      }
    }

    return { markdown: md };
  },
);
