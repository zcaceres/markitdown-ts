import { converter, allOf, anyOf, byMime, byExt, byUrl } from "../converter.js";
import { decodeBuffer } from "../transforms/decode-text.js";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { tables } from "turndown-plugin-gfm";

const ACCEPTED_EXTENSIONS = [".html", ".htm"];
const ACCEPTED_MIME_PREFIXES = ["text/html", "application/xhtml"];

export const wikipediaConverter = converter(
  "Wikipedia",
  allOf(
    byUrl(/^https?:\/\/[a-zA-Z]{2,3}\.wikipedia\.org\//),
    anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  ),
  async (ctx) => {
    const encoding = ctx.info.charset ?? "utf-8";
    const html = decodeBuffer(ctx.buffer, encoding);
    const $ = cheerio.load(html);

    // Remove script and style blocks
    $("script, style").remove();

    // Extract title
    let mainTitle = $("title").first().text() || undefined;
    const titleElm = $("span.mw-page-title-main").first();
    if (titleElm.length) {
      mainTitle = titleElm.text();
    }

    // Get main content
    const bodyElm = $("#mw-content-text");
    let contentHtml: string;
    if (bodyElm.length) {
      contentHtml = bodyElm.html() || "";
    } else {
      contentHtml = $("body").html() || $.html() || "";
    }

    const td = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "*",
      emDelimiter: "*",
    });
    td.use(tables);

    // Custom link rule to properly format Wikipedia links
    td.addRule("links", {
      filter: "a",
      replacement(content, node) {
        const el = node as HTMLAnchorElement;
        const href = el.getAttribute("href") || "";
        const title = el.getAttribute("title") || "";
        if (!content.trim()) return "";

        if (href) {
          try {
            const url = new URL(href, "http://placeholder.invalid");
            const scheme = url.protocol.replace(":", "").toLowerCase();
            if (scheme && !["http", "https", "file"].includes(scheme)) {
              if (href.includes(":") && !href.startsWith("/") && !href.startsWith("#")) {
                return content;
              }
            }
          } catch {
            // relative URL
          }
        }

        const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
        return href ? `[${content}](${href}${titlePart})` : content;
      },
    });

    let markdown = td.turndown(contentHtml).trim();

    // Prepend title
    if (mainTitle) {
      markdown = `# ${mainTitle}\n\n${markdown}`;
    }

    return { markdown, title: mainTitle };
  },
);
