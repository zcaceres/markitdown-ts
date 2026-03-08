import path from "node:path";
import { converter, anyOf, byMime, byExt } from "../converter.js";
import { htmlToMarkdown } from "../transforms/html-to-markdown.js";
import { decodeBuffer } from "../transforms/decode-text.js";

const ACCEPTED_EXTENSIONS = [".epub"];
const ACCEPTED_MIME_PREFIXES = [
  "application/epub",
  "application/epub+zip",
  "application/x-epub+zip",
];

export const epubConverter = converter(
  "EPUB",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const JSZip = (await import("jszip")).default;
    const { XMLParser } = await import("fast-xml-parser");

    const zip = await JSZip.loadAsync(ctx.buffer);

    // Parse META-INF/container.xml to find content.opf
    const containerXml = await zip.file("META-INF/container.xml")?.async("text");
    if (!containerXml) throw new Error("Invalid EPUB: missing META-INF/container.xml");

    const containerParser = new XMLParser({ ignoreAttributes: false });
    const container = containerParser.parse(containerXml);

    // Navigate to rootfile full-path
    const rootfiles = container?.container?.rootfiles?.rootfile;
    const rootfile = Array.isArray(rootfiles) ? rootfiles[0] : rootfiles;
    const opfPath: string = rootfile?.["@_full-path"];
    if (!opfPath) throw new Error("Invalid EPUB: cannot find content.opf path");

    // Parse content.opf
    const opfXml = await zip.file(opfPath)?.async("text");
    if (!opfXml) throw new Error(`Invalid EPUB: missing ${opfPath}`);

    const opfParser = new XMLParser({ ignoreAttributes: false });
    const opf = opfParser.parse(opfXml);
    const pkg = opf?.["package"] ?? opf?.package;

    // Extract metadata
    const meta = pkg?.metadata ?? {};
    const metadata: Record<string, string | null> = {
      title: extractText(meta, "dc:title"),
      authors: extractAllTexts(meta, "dc:creator").join(", ") || null,
      language: extractText(meta, "dc:language"),
      publisher: extractText(meta, "dc:publisher"),
      date: extractText(meta, "dc:date"),
      description: extractText(meta, "dc:description"),
      identifier: extractText(meta, "dc:identifier"),
    };

    // Build manifest map (id → href)
    const manifestItems = asArray(pkg?.manifest?.item);
    const manifest = new Map<string, string>();
    for (const item of manifestItems) {
      const id = item["@_id"];
      const href = item["@_href"];
      if (id && href) manifest.set(id, href);
    }

    // Extract spine order
    const spineItems = asArray(pkg?.spine?.itemref);
    const spineOrder = spineItems
      .map((item: any) => item["@_idref"])
      .filter(Boolean);

    // Resolve spine file paths relative to content.opf
    const basePath = opfPath.includes("/")
      ? opfPath.split("/").slice(0, -1).join("/")
      : "";

    const spineFiles = spineOrder
      .map((id: string) => {
        const href = manifest.get(id);
        if (!href) return null;
        return basePath ? `${basePath}/${href}` : href;
      })
      .filter(Boolean) as string[];

    // Convert each spine file
    const markdownParts: string[] = [];

    for (const file of spineFiles) {
      const zipFile = zip.file(file);
      if (!zipFile) continue;

      const htmlBuffer = Buffer.from(await zipFile.async("nodebuffer"));
      const htmlText = decodeBuffer(htmlBuffer, "utf-8");
      const { markdown } = htmlToMarkdown(htmlText, ctx.opts);
      const trimmed = markdown.trim();
      if (trimmed) markdownParts.push(trimmed);
    }

    // Format metadata
    const metadataLines: string[] = [];
    for (const [key, value] of Object.entries(metadata)) {
      if (value) {
        metadataLines.push(
          `**${key.charAt(0).toUpperCase() + key.slice(1)}:** ${value}`,
        );
      }
    }

    if (metadataLines.length > 0) {
      markdownParts.unshift(metadataLines.join("\n"));
    }

    return {
      markdown: markdownParts.join("\n\n"),
      title: metadata.title ?? undefined,
    };
  },
);

function extractText(meta: any, tag: string): string | null {
  const val = meta?.[tag];
  if (!val) return null;
  if (typeof val === "string") return val;
  if (typeof val === "object" && "#text" in val) return val["#text"];
  if (Array.isArray(val)) {
    const first = val[0];
    if (typeof first === "string") return first;
    if (typeof first === "object" && "#text" in first) return first["#text"];
  }
  return null;
}

function extractAllTexts(meta: any, tag: string): string[] {
  const val = meta?.[tag];
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr
    .map((v: any) => {
      if (typeof v === "string") return v;
      if (typeof v === "object" && "#text" in v) return v["#text"];
      return null;
    })
    .filter(Boolean) as string[];
}

function asArray(val: any): any[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}
