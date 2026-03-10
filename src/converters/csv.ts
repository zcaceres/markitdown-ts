import { converter, anyOf, byMime, byExt } from "../converter.js";
import { decodeBuffer } from "../transforms/decode-text.js";

const ACCEPTED_EXTENSIONS = [".csv"];
const ACCEPTED_MIME_PREFIXES = ["text/csv", "application/csv"];

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;

  // Split respecting quoted fields that may contain newlines
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (inQuotes) {
      // Continue the previous field across the newline
      current += "\n" + line;
    } else {
      if (current.trim() !== "" || rows.length > 0) {
        if (current.trim() !== "") rows.push(parseCsvLine(current));
      }
      current = line;
    }

    // Count unescaped quotes to track state
    let quotes = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          i++; // skip escaped quote
        } else {
          quotes++;
        }
      }
    }

    // Toggle inQuotes based on parity: odd toggles state
    if (quotes % 2 !== 0) inQuotes = !inQuotes;
  }

  // Don't forget the last line
  if (current.trim() !== "") rows.push(parseCsvLine(current));

  return rows;
}

export const csvConverter = converter(
  "CSV",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const text = decodeBuffer(ctx.buffer, ctx.info.charset);
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return { markdown: "" };
    }

    const header = rows[0];
    const numCols = header.length;
    const mdLines: string[] = [];

    // Header row
    mdLines.push("| " + header.join(" | ") + " |");
    // Separator row
    mdLines.push("| " + header.map(() => "---").join(" | ") + " |");
    // Data rows
    for (let i = 1; i < rows.length; i++) {
      let row = rows[i];
      // Pad if fewer columns
      while (row.length < numCols) row.push("");
      // Truncate if more columns
      row = row.slice(0, numCols);
      mdLines.push("| " + row.join(" | ") + " |");
    }

    return { markdown: mdLines.join("\n") };
  },
);
