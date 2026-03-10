import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { tables } from "turndown-plugin-gfm";
import type { ConvertOptions } from "../types.js";

function createTurndownService(opts?: ConvertOptions): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "*",
    emDelimiter: "*",
  });

  // Enable GFM tables
  td.use(tables);

  // Custom rule: remove javascript links, escape URIs properly
  td.addRule("links", {
    filter: "a",
    replacement(content, node) {
      const el = node as HTMLAnchorElement;
      const href = el.getAttribute("href") || "";
      const title = el.getAttribute("title") || "";

      if (!content.trim()) return "";

      // Skip non-http/file schemes (javascript:, mailto:, etc.)
      if (href) {
        try {
          const url = new URL(href, "http://placeholder.invalid");
          const scheme = url.protocol.replace(":", "").toLowerCase();
          if (scheme && !["http", "https", "file"].includes(scheme)) {
            // Check if it's a relative URL (no scheme in original href)
            if (href.includes(":") && !href.startsWith("/") && !href.startsWith("#")) {
              return content;
            }
          }
        } catch {
          // Relative URL or invalid — keep as-is
        }
      }

      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
      return href ? `[${content}](${href}${titlePart})` : content;
    },
  });

  // Custom rule: handle images, truncate data URIs
  td.addRule("images", {
    filter: "img",
    replacement(_content, node) {
      const el = node as HTMLImageElement;
      let alt = (el.getAttribute("alt") || "").replace(/\n/g, " ");
      let src = el.getAttribute("src") || el.getAttribute("data-src") || "";
      const title = el.getAttribute("title") || "";

      // Truncate data URIs unless keep_data_uris is set
      if (src.startsWith("data:") && !opts?.keepDataUris) {
        src = src.split(",")[0] + "...";
      }

      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
      return `![${alt}](${src}${titlePart})`;
    },
  });

  // Custom rule: list items with single space after marker (matches Python markdownify)
  td.addRule("listItem", {
    filter: "li",
    replacement(content, node, options) {
      content = content
        .replace(/^\n+/, "")
        .replace(/\n+$/, "\n")
        .replace(/\n/gm, "\n  ");

      const parent = node.parentNode as HTMLElement;
      const isOrdered = parent?.nodeName === "OL";
      let prefix: string;

      if (isOrdered) {
        const start = parent.getAttribute("start");
        const index = Array.prototype.indexOf.call(parent.children, node);
        const num = (start ? parseInt(start, 10) : 1) + index;
        prefix = num + ". ";
      } else {
        prefix = options.bulletListMarker + " ";
      }

      return prefix + content + (node.nextSibling ? "\n" : "");
    },
  });

  // Custom rule: definition lists (used by mammoth for DOCX comments)
  td.addRule("definitionList", {
    filter: "dl",
    replacement(content) {
      return "\n\n" + content + "\n\n";
    },
  });

  td.addRule("definitionTerm", {
    filter: "dt",
    replacement(content) {
      return "\n" + content + "\n";
    },
  });

  td.addRule("definitionDescription", {
    filter: "dd",
    replacement(content) {
      return ":   " + content.trim() + "\n";
    },
  });

  // Custom rule: convert checkboxes
  td.addRule("checkboxes", {
    filter(node) {
      return (
        node.nodeName === "INPUT" &&
        (node as HTMLInputElement).getAttribute("type") === "checkbox"
      );
    },
    replacement(_content, node) {
      const el = node as HTMLInputElement;
      return el.hasAttribute("checked") ? "[x] " : "[ ] ";
    },
  });

  return td;
}

export function htmlToMarkdown(
  html: string,
  opts?: ConvertOptions,
): { markdown: string; title?: string } {
  const $ = cheerio.load(html);

  // Remove script and style elements
  $("script, style").remove();

  // Extract title
  const title = $("title").first().text() || undefined;

  // Strip <p> wrappers inside table cells to avoid multi-line cell content (DOM-based)
  $("td, th").each((_, el) => {
    const $el = $(el);
    $el.find("> p").each((_, p) => {
      $(p).replaceWith($(p).html() + " ");
    });
    $el.html(($el.html() || "").trim());
  });

  // Promote first <tr> to <thead><tr><th> if missing, so Turndown GFM tables work (DOM-based)
  $("table").each((_, table) => {
    const $table = $(table);
    if ($table.find("thead").length) return;

    const $firstRow = $table.find("> tr, > tbody > tr").first();
    if (!$firstRow.length) return;

    // Convert td to th in first row
    $firstRow.find("> td").each((_, td) => {
      const $td = $(td);
      const $th = $("<th>").html($td.html() || "");
      const attrs = (td as any).attribs || {};
      for (const [name, value] of Object.entries(attrs)) {
        $th.attr(name, value as string);
      }
      $td.replaceWith($th);
    });

    // Wrap first row in thead
    const $thead = $("<thead>").append($firstRow.clone());
    $firstRow.remove();

    // Ensure remaining rows are in tbody
    const $tbody = $table.find("> tbody");
    if (!$tbody.length) {
      const remainingRows = $table.find("> tr");
      if (remainingRows.length) {
        const $newTbody = $("<tbody>");
        remainingRows.each((_, row) => { $newTbody.append($(row)); });
        $table.append($newTbody);
      }
    }

    $table.prepend($thead);
  });

  // Get processed HTML from cheerio DOM
  const body = $("body");
  const processedHtml = body.length > 0 ? body.html() || "" : $.html() || "";

  const td = createTurndownService(opts);
  let markdown = td.turndown(processedHtml);

  // Trim leading/trailing whitespace
  markdown = markdown.trim();

  return { markdown, title };
}
