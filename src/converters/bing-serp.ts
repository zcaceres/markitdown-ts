import { converter, allOf, anyOf, byMime, byExt, byUrl } from "../converter.js";
import { decodeBuffer } from "../transforms/decode-text.js";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const ACCEPTED_EXTENSIONS = [".html", ".htm"];
const ACCEPTED_MIME_PREFIXES = ["text/html", "application/xhtml"];

function decodeRedirectUrl(href: string): string {
  try {
    const url = new URL(href);
    const u = url.searchParams.get("u");
    if (!u) return href;

    // Strip prefix (first 2 chars) and add padding
    const encoded = u.slice(2).trim() + "==";
    // RFC 4648 URL-safe base64
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf-8");
    return decoded;
  } catch {
    return href;
  }
}

export const bingSerpConverter = converter(
  "BingSerp",
  allOf(
    byUrl(/^https:\/\/www\.bing\.com\/search\?q=/),
    anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  ),
  async (ctx) => {
    const encoding = ctx.info.charset ?? "utf-8";
    const html = decodeBuffer(ctx.buffer, encoding);
    const $ = cheerio.load(html);

    // Parse query
    const url = ctx.info.url ?? "";
    let query = "";
    try {
      const parsed = new URL(url);
      query = parsed.searchParams.get("q") || "";
    } catch {
      // ignore
    }

    // Clean up formatting
    $(".tptt").each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      if (text) $el.text(text + " ");
    });
    $(".algoSlug_icon").remove();

    // Convert results
    const td = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    // Custom link handler to decode Bing redirect URLs
    td.addRule("links", {
      filter: "a",
      replacement(content, node) {
        const el = node as HTMLAnchorElement;
        let href = el.getAttribute("href") || "";
        const title = el.getAttribute("title") || "";
        if (!content.trim()) return "";

        // Decode Bing redirect URLs
        if (href.includes("bing.com") && href.includes("u=")) {
          href = decodeRedirectUrl(href);
        }

        const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
        return href ? `[${content}](${href}${titlePart})` : content;
      },
    });

    // Custom image handler to remove data URIs
    td.addRule("images", {
      filter: "img",
      replacement(_content, node) {
        const el = node as HTMLImageElement;
        const src = el.getAttribute("src") || "";
        if (src.startsWith("data:")) return "";
        const alt = (el.getAttribute("alt") || "").replace(/\n/g, " ");
        return `![${alt}](${src})`;
      },
    });

    const results: string[] = [];
    $(".b_algo").each((_, el) => {
      const resultHtml = $(el).html();
      if (!resultHtml) return;
      let mdResult = td.turndown(resultHtml).trim();
      const lines = mdResult
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      results.push(lines.join("\n"));
    });

    const title = $("title").first().text() || undefined;
    const markdown =
      `## A Bing search for '${query}' found the following results:\n\n` +
      results.join("\n\n");

    return { markdown, title };
  },
);
