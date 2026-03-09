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

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

async function fetchTranscript(
  videoId: string,
  languages?: string[],
): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");

    // Try each preferred language, then fall back to no language preference
    const langAttempts = languages && languages.length > 0
      ? [...languages, undefined]
      : [undefined];

    for (const lang of langAttempts) {
      // Retry logic: 3 retries, 2s delay
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const config = lang ? { lang } : undefined;
          const parts = await YoutubeTranscript.fetchTranscript(videoId, config);
          if (parts && parts.length > 0) {
            return parts.map((p) => p.text).join(" ");
          }
          break; // Empty result, try next language
        } catch (e) {
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else if (lang !== undefined) {
            break; // Language not available, try next
          } else {
            throw e; // Final fallback failed
          }
        }
      }
    }
    return null;
  } catch {
    // youtube-transcript not available or transcript fetch failed
    return null;
  }
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

    // Fetch transcript if video ID available
    const videoId = ctx.info.url ? extractVideoId(ctx.info.url) : null;
    if (videoId) {
      const transcript = await fetchTranscript(
        videoId,
        ctx.opts.youtubeTranscriptLanguages,
      );
      if (transcript) {
        md += `\n### Transcript\n${transcript}\n`;
      }
    }

    return { markdown: md, title: title || undefined };
  },
);
