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

    // Convert sheet to HTML, then fix table structure for Turndown GFM tables
    let html = XLSX.utils.sheet_to_html(sheet);

    // SheetJS outputs <table><tr><td>...</td></tr>... without <thead>/<th>.
    // Turndown's GFM tables plugin requires <thead>+<th> to produce markdown tables.
    // Promote the first <tr> of each <table> to <thead><tr><th>...</th></tr></thead>.
    html = html.replace(
      /<table>([\s\S]*?)<\/table>/g,
      (_match, inner: string) => {
        const firstRowMatch = inner.match(
          /^(\s*(?:<tbody>\s*)?)<tr>([\s\S]*?)<\/tr>/,
        );
        if (!firstRowMatch) return _match;

        const prefix = firstRowMatch[1]; // may include <tbody>
        const headerCells = firstRowMatch[2];
        const rest = inner.slice(firstRowMatch[0].length);

        // Convert <td> to <th> in the header row
        const thCells = headerCells.replace(/<td\b[^>]*>([\s\S]*?)<\/td>/g, "<th>$1</th>");

        // Strip any <tbody> that was before the first row
        const cleanPrefix = prefix.replace(/<tbody>\s*/, "");
        const restWithTbody = rest.includes("<tbody>") ? rest : `<tbody>${rest}`;

        return `<table>${cleanPrefix}<thead><tr>${thCells}</tr></thead>${restWithTbody}</table>`;
      },
    );

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
