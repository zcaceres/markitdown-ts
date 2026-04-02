import { anyOf, byExt, byMime, converter } from "../converter.js";

const ACCEPTED_EXTENSIONS = [".msg"];
const ACCEPTED_MIME_PREFIXES = ["application/vnd.ms-outlook"];

const STREAM_FROM = "__substg1.0_0C1F001F";
const STREAM_TO = "__substg1.0_0E04001F";
const STREAM_SUBJECT = "__substg1.0_0037001F";
const STREAM_BODY = "__substg1.0_1000001F";

export const outlookMsgConverter = converter(
  "OutlookMSG",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const CFB = await import("cfb");
    const cfb = CFB.read(ctx.buffer, { type: "buffer" });

    function getStream(streamPath: string): string | null {
      const paths = [`/${streamPath}`, streamPath, `/Root Entry/${streamPath}`];
      for (const p of paths) {
        const entry = CFB.find(cfb, p);
        if (entry?.content) {
          const data = entry.content as Uint8Array;
          try {
            const text = new TextDecoder("utf-16le").decode(data).trim();
            if (text) return text;
          } catch {
            /* ignore */
          }
          try {
            return new TextDecoder("utf-8").decode(data).trim();
          } catch {
            return new TextDecoder("utf-8", { fatal: false }).decode(data).trim();
          }
        }
      }
      return null;
    }

    const from = getStream(STREAM_FROM);
    const to = getStream(STREAM_TO);
    const subject = getStream(STREAM_SUBJECT);
    const body = getStream(STREAM_BODY);

    let md = "# Email Message\n\n";
    if (from) md += `**From:** ${from}\n`;
    if (to) md += `**To:** ${to}\n`;
    if (subject) md += `**Subject:** ${subject}\n`;
    md += "\n## Content\n\n";
    if (body) md += body;

    return {
      markdown: md.trim(),
      title: subject ?? undefined,
    };
  },
);
