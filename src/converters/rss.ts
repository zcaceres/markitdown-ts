import { XMLParser } from "fast-xml-parser";
import { anyOf, byExt, byMime, converter } from "../converter.js";
import { decodeBuffer } from "../transforms/decode-text.js";
import { htmlToMarkdown } from "../transforms/html-to-markdown.js";

const PRECISE_MIME_PREFIXES = ["application/rss", "application/rss+xml", "application/atom", "application/atom+xml"];
const PRECISE_EXTENSIONS = [".rss", ".atom"];
const CANDIDATE_MIME_PREFIXES = ["text/xml", "application/xml"];
const CANDIDATE_EXTENSIONS = [".xml"];

function getFirstTextChild(parent: any, tagName: string): string | null {
  if (!parent) return null;
  const val = parent[tagName];
  if (val === undefined || val === null) return null;
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object" && val["#text"] !== undefined) return String(val["#text"]);
  return null;
}

function parseContent(content: string): string {
  try {
    const { markdown } = htmlToMarkdown(content);
    return markdown;
  } catch {
    return content;
  }
}

function detectFeedType(parsed: any): "rss" | "atom" | null {
  if (parsed.rss) return "rss";
  if (parsed.feed) {
    const feed = parsed.feed;
    if (feed.entry || (Array.isArray(feed) && feed.some((f: any) => f.entry))) {
      return "atom";
    }
  }
  return null;
}

function looksLikeFeed(buffer: Buffer, charset?: string): boolean {
  try {
    const text = decodeBuffer(buffer, charset ?? "utf-8");
    const parser = new XMLParser({ ignoreAttributes: true });
    const parsed = parser.parse(text);
    return detectFeedType(parsed) !== null;
  } catch {
    return false;
  }
}

export const rssConverter = converter(
  "RSS",
  anyOf(
    byExt(...PRECISE_EXTENSIONS),
    byMime(...PRECISE_MIME_PREFIXES),
    // For generic XML, also check content
    (ctx) => {
      const mime = (ctx.info.mimetype ?? "").toLowerCase();
      const ext = (ctx.info.extension ?? "").toLowerCase();
      const isCandidate = CANDIDATE_EXTENSIONS.includes(ext) || CANDIDATE_MIME_PREFIXES.some((p) => mime.startsWith(p));
      if (!isCandidate) return false;
      return looksLikeFeed(ctx.buffer, ctx.info.charset);
    },
  ),
  async (ctx) => {
    const text = decodeBuffer(ctx.buffer, ctx.info.charset ?? "utf-8");
    const parser = new XMLParser({
      ignoreAttributes: true,
      textNodeName: "#text",
      cdataPropName: "__cdata",
    });
    const parsed = parser.parse(text);
    const feedType = detectFeedType(parsed);

    if (feedType === "rss") {
      return parseRss(parsed);
    } else if (feedType === "atom") {
      return parseAtom(parsed);
    }
    throw new Error("Unknown feed type");
  },
);

function parseRss(parsed: any): { markdown: string; title?: string } {
  const rss = parsed.rss;
  const channel = rss.channel;
  if (!channel) throw new Error("No channel found in RSS feed");

  const channelTitle = getFirstTextChild(channel, "title");
  const channelDescription = getFirstTextChild(channel, "description");

  let md = "";
  if (channelTitle) md += `# ${channelTitle}\n`;
  if (channelDescription) md += `${channelDescription}\n`;

  let items = channel.item;
  if (items && !Array.isArray(items)) items = [items];
  if (items) {
    for (const item of items) {
      const title = getFirstTextChild(item, "title");
      const description =
        getFirstTextChild(item, "description") || (item.description?.__cdata ? String(item.description.__cdata) : null);
      const pubDate = getFirstTextChild(item, "pubDate");
      const content =
        getFirstTextChild(item, "content:encoded") ||
        (item["content:encoded"]?.__cdata ? String(item["content:encoded"].__cdata) : null);

      if (title) md += `\n## ${title}\n`;
      if (pubDate) md += `Published on: ${pubDate}\n`;
      if (description) md += parseContent(description);
      if (content) md += parseContent(content);
    }
  }

  return { markdown: md, title: channelTitle ?? undefined };
}

function parseAtom(parsed: any): { markdown: string; title?: string } {
  const feed = parsed.feed;
  const title = getFirstTextChild(feed, "title");
  const subtitle = getFirstTextChild(feed, "subtitle");

  let md = "";
  if (title) md += `# ${title}\n`;
  if (subtitle) md += `${subtitle}\n`;

  let entries = feed.entry;
  if (entries && !Array.isArray(entries)) entries = [entries];
  if (entries) {
    for (const entry of entries) {
      const entryTitle = getFirstTextChild(entry, "title");
      const entrySummary = getFirstTextChild(entry, "summary");
      const entryUpdated = getFirstTextChild(entry, "updated");
      const entryContent = getFirstTextChild(entry, "content");

      if (entryTitle) md += `\n## ${entryTitle}\n`;
      if (entryUpdated) md += `Updated on: ${entryUpdated}\n`;
      if (entrySummary) md += parseContent(entrySummary);
      if (entryContent) md += parseContent(entryContent);
    }
  }

  return { markdown: md, title: title ?? undefined };
}
