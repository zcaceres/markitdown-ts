import { converter, anyOf, byMime, byExt } from "../converter.js";
import * as XLSX from "xlsx";
import { htmlToMarkdown } from "../transforms/html-to-markdown.js";

const ACCEPTED_XLSX_EXTENSIONS = [".xlsx"];
const ACCEPTED_XLSX_MIME_PREFIXES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ACCEPTED_XLS_EXTENSIONS = [".xls"];
const ACCEPTED_XLS_MIME_PREFIXES = [
  "application/vnd.ms-excel",
  "application/excel",
];

function sheetsToMarkdown(workbook: XLSX.WorkBook): string {
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    parts.push(`## ${sheetName}`);

    // Convert sheet to HTML and then to markdown
    const html = XLSX.utils.sheet_to_html(sheet);
    const { markdown } = htmlToMarkdown(html);
    parts.push(markdown.trim());
    parts.push("");
  }

  return parts.join("\n").trim();
}

export const xlsxConverter = converter(
  "XLSX",
  anyOf(
    byExt(...ACCEPTED_XLSX_EXTENSIONS),
    byMime(...ACCEPTED_XLSX_MIME_PREFIXES),
  ),
  async (ctx) => {
    const workbook = XLSX.read(ctx.buffer, { type: "buffer" });
    return { markdown: sheetsToMarkdown(workbook) };
  },
);

export const xlsConverter = converter(
  "XLS",
  anyOf(
    byExt(...ACCEPTED_XLS_EXTENSIONS),
    byMime(...ACCEPTED_XLS_MIME_PREFIXES),
  ),
  async (ctx) => {
    const workbook = XLSX.read(ctx.buffer, { type: "buffer" });
    return { markdown: sheetsToMarkdown(workbook) };
  },
);
