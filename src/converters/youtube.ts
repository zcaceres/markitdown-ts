import { converter, allOf, anyOf, byMime, byExt, byUrl } from "../converter.js";
import { decodeBuffer } from "../transforms/decode-text.js";
import * as cheerio from "cheerio";

const ACCEPTED_EXTENSIONS = [".html", ".htm"];
const ACCEPTED_MIME_PREFIXES = ["text/html", "application/xhtml"];

function findKey(obj: any, key: string): any {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findKey(item, key);
      if (result !== undefined) return result;
    }
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) return v;
      const result = findKey(v, key);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

export const youtubeConverter = converter(
  "YouTube",
  allOf(
    byUrl(/^https:\/\/www\.youtube\.com\/watch\?/),
    anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  ),
  async (ctx) => {
    const encoding = ctx.info.charset ?? "utf-8";
    const html = decodeBuffer(ctx.buffer, encoding);
    const $ = cheerio.load(html);

    // Read meta tags
    const metadata: Record<string, string> = {};
    const titleText = $("title").first().text();
    if (titleText) metadata["title"] = titleText;

    $("meta").each((_, el) => {
      const $el = $(el);
      for (const attr of ["itemprop", "property", "name"]) {
        const key = $el.attr(attr);
        const content = $el.attr("content");
        if (key && content) {
          metadata[key] = content;
          break;
        }
      }
    });

    // Try extracting description from ytInitialData
    $("script").each((_, el) => {
      const content = $(el).html();
      if (!content || !content.includes("ytInitialData")) return;
      const match = content.match(/var ytInitialData = ({.*?});/);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const attrDesc = findKey(data, "attributedDescriptionBodyText");
          if (attrDesc && typeof attrDesc === "object" && attrDesc.content) {
            metadata["description"] = String(attrDesc.content);
          }
        } catch {
          // ignore parse errors
        }
      }
    });

    // Build markdown
    let md = "# YouTube\n";

    const title = metadata["title"] || metadata["og:title"] || metadata["name"] || "";
    if (title) md += `\n## ${title}\n`;

    let stats = "";
    if (metadata["interactionCount"]) stats += `- **Views:** ${metadata["interactionCount"]}\n`;
    if (metadata["keywords"]) stats += `- **Keywords:** ${metadata["keywords"]}\n`;
    if (metadata["duration"]) stats += `- **Runtime:** ${metadata["duration"]}\n`;
    if (stats) md += `\n### Video Metadata\n${stats}\n`;

    const description = metadata["description"] || metadata["og:description"];
    if (description) md += `\n### Description\n${description}\n`;

    return { markdown: md, title: title || undefined };
  },
);
