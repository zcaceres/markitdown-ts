import { converter, anyOf, byMime, byExt } from "../converter.js";
import path from "node:path";
import fs from "node:fs";

const ACCEPTED_EXTENSIONS = [".pdf"];
const ACCEPTED_MIME_PREFIXES = ["application/pdf", "application/x-pdf"];

// Pattern for MasterFormat-style partial numbering (e.g., ".1", ".2", ".10")
const PARTIAL_NUMBERING_PATTERN = /^\.\d+$/;

/** Normalized word with flat x0/top/x1/bottom (handles bbox nesting) */
interface Word {
  text: string;
  x0: number;
  top: number;
  x1: number;
  bottom: number;
}

/** Normalize a pdfplumber-wasm word which may have bbox nesting */
function normalizeWord(w: any): Word {
  if (w.bbox) {
    return {
      text: w.text,
      x0: w.bbox.x0,
      top: w.bbox.top,
      x1: w.bbox.x1,
      bottom: w.bbox.bottom,
    };
  }
  return { text: w.text, x0: w.x0, top: w.top, x1: w.x1, bottom: w.bottom };
}

/**
 * Post-process extracted text to merge MasterFormat-style partial numbering
 * with the following text line.
 */
function mergePartialNumberingLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const stripped = lines[i].trim();

    if (PARTIAL_NUMBERING_PATTERN.test(stripped)) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length) {
        result.push(`${stripped} ${lines[j].trim()}`);
        i = j + 1;
      } else {
        result.push(lines[i]);
        i++;
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n");
}

interface RowInfo {
  yKey: number;
  words: Word[];
  text: string;
  xGroups: number[];
  isParagraph: boolean;
  numColumns: number;
  hasPartialNumbering: boolean;
  isTableRow?: boolean;
}

/**
 * Extract form-style content from a PDF page by analyzing word positions.
 * Returns null if not form-style.
 */
function extractFormContentFromWords(
  words: Word[],
  pageWidth: number,
): string | null {
  if (!words.length) return null;

  const yTolerance = 5;
  const rowsByY = new Map<number, Word[]>();
  for (const word of words) {
    const yKey = Math.round(word.top / yTolerance) * yTolerance;
    let arr = rowsByY.get(yKey);
    if (!arr) { arr = []; rowsByY.set(yKey, arr); }
    arr.push(word);
  }

  const sortedYKeys = [...rowsByY.keys()].sort((a, b) => a - b);

  const rowInfo: RowInfo[] = [];
  for (const yKey of sortedYKeys) {
    const rowWords = rowsByY.get(yKey)!.sort((a, b) => a.x0 - b.x0);
    if (!rowWords.length) continue;

    const firstX0 = rowWords[0].x0;
    const lastX1 = rowWords[rowWords.length - 1].x1;
    const lineWidth = lastX1 - firstX0;
    const combinedText = rowWords.map((w) => w.text).join(" ");

    const xPositions = rowWords.map((w) => w.x0);
    const xGroups: number[] = [];
    for (const x of [...xPositions].sort((a, b) => a - b)) {
      if (!xGroups.length || x - xGroups[xGroups.length - 1] > 50) {
        xGroups.push(x);
      }
    }

    const isParagraph = lineWidth > pageWidth * 0.55 && combinedText.length > 60;

    let hasPartialNumbering = false;
    if (rowWords.length) {
      const firstWord = rowWords[0].text.trim();
      if (PARTIAL_NUMBERING_PATTERN.test(firstWord)) hasPartialNumbering = true;
    }

    rowInfo.push({
      yKey, words: rowWords, text: combinedText, xGroups,
      isParagraph, numColumns: xGroups.length, hasPartialNumbering,
    });
  }

  const allTableXPositions: number[] = [];
  for (const info of rowInfo) {
    if (info.numColumns >= 3 && !info.isParagraph) {
      allTableXPositions.push(...info.xGroups);
    }
  }
  if (!allTableXPositions.length) return null;

  allTableXPositions.sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 0; i < allTableXPositions.length - 1; i++) {
    const gap = allTableXPositions[i + 1] - allTableXPositions[i];
    if (gap > 5) gaps.push(gap);
  }

  let adaptiveTolerance: number;
  if (gaps.length >= 3) {
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const idx = Math.floor(sortedGaps.length * 0.7);
    adaptiveTolerance = Math.max(25, Math.min(50, sortedGaps[idx]));
  } else {
    adaptiveTolerance = 35;
  }

  const globalColumns: number[] = [];
  for (const x of allTableXPositions) {
    if (!globalColumns.length || x - globalColumns[globalColumns.length - 1] > adaptiveTolerance) {
      globalColumns.push(x);
    }
  }

  if (globalColumns.length > 1) {
    const contentWidth = globalColumns[globalColumns.length - 1] - globalColumns[0];
    const avgColWidth = contentWidth / globalColumns.length;
    if (avgColWidth < 30) return null;
    const columnsPerInch = globalColumns.length / (contentWidth / 72);
    if (columnsPerInch > 10) return null;
    const adaptiveMaxColumns = Math.max(15, Math.floor(20 * (pageWidth / 612)));
    if (globalColumns.length > adaptiveMaxColumns) return null;
  } else {
    return null;
  }

  const numCols = globalColumns.length;

  for (const info of rowInfo) {
    if (info.isParagraph || info.hasPartialNumbering) {
      info.isTableRow = false;
      continue;
    }
    const alignedColumns = new Set<number>();
    for (const word of info.words) {
      for (let colIdx = 0; colIdx < globalColumns.length; colIdx++) {
        if (Math.abs(word.x0 - globalColumns[colIdx]) < 40) {
          alignedColumns.add(colIdx);
          break;
        }
      }
    }
    info.isTableRow = alignedColumns.size >= 2;
  }

  const tableRegions: [number, number][] = [];
  let i = 0;
  while (i < rowInfo.length) {
    if (rowInfo[i].isTableRow) {
      const start = i;
      while (i < rowInfo.length && rowInfo[i].isTableRow) i++;
      tableRegions.push([start, i]);
    } else { i++; }
  }

  const totalTableRows = tableRegions.reduce((sum, [s, e]) => sum + (e - s), 0);
  if (rowInfo.length > 0 && totalTableRows / rowInfo.length < 0.2) return null;

  function extractCells(info: RowInfo): string[] {
    const cells = Array(numCols).fill("");
    for (const word of info.words) {
      let assignedCol = numCols - 1;
      for (let colIdx = 0; colIdx < numCols - 1; colIdx++) {
        if (word.x0 < globalColumns[colIdx + 1] - 20) {
          assignedCol = colIdx;
          break;
        }
      }
      cells[assignedCol] = cells[assignedCol]
        ? cells[assignedCol] + " " + word.text
        : word.text;
    }
    return cells;
  }

  const resultLines: string[] = [];
  let idx = 0;
  while (idx < rowInfo.length) {
    const region = tableRegions.find(([start]) => start === idx);
    if (region) {
      const [start, end] = region;
      const tableData: string[][] = [];
      for (let ti = start; ti < end; ti++) {
        tableData.push(extractCells(rowInfo[ti]));
      }
      if (tableData.length) {
        const colWidths = Array.from({ length: numCols }, (_, col) =>
          Math.max(3, ...tableData.map((row) => (row[col] || "").length)),
        );
        const header = tableData[0];
        resultLines.push(
          "| " + header.map((cell, ci) => cell.padEnd(colWidths[ci])).join(" | ") + " |",
        );
        resultLines.push(
          "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |",
        );
        for (const row of tableData.slice(1)) {
          resultLines.push(
            "| " + row.map((cell, ci) => cell.padEnd(colWidths[ci])).join(" | ") + " |",
          );
        }
      }
      idx = end;
    } else {
      const inTable = tableRegions.some(([s, e]) => s < idx && idx < e);
      if (!inTable) resultLines.push(rowInfo[idx].text);
      idx++;
    }
  }

  return resultLines.join("\n");
}

// --- pdfplumber-wasm initialization for Bun ---

let _wasmInitialized = false;
let _WasmPdf: any = null;

async function initPdfplumber(): Promise<any> {
  if (_wasmInitialized) return _WasmPdf;

  const bgModule: any = await import("pdfplumber-wasm/pdfplumber_wasm_bg.js");

  // Build imports object for WASM instantiation
  const imports: Record<string, Record<string, any>> = {
    "./pdfplumber_wasm_bg.js": {},
  };
  for (const [key, value] of Object.entries(bgModule)) {
    if (
      (key.startsWith("__wbg_") || key.startsWith("__wbindgen_")) &&
      typeof value === "function"
    ) {
      imports["./pdfplumber_wasm_bg.js"][key] = value;
    }
  }

  // Find and load the WASM file
  const wasmPath = path.join(
    path.dirname(require.resolve("pdfplumber-wasm/package.json")),
    "pdfplumber_wasm_bg.wasm",
  );
  const wasmBytes = fs.readFileSync(wasmPath);
  const wasmModule = new WebAssembly.Module(wasmBytes);
  const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
  bgModule.__wbg_set_wasm(wasmInstance.exports);

  if (typeof (wasmInstance.exports as any).__wbindgen_start === "function") {
    (wasmInstance.exports as any).__wbindgen_start();
  }

  _WasmPdf = bgModule.WasmPdf;
  _wasmInitialized = true;
  return _WasmPdf;
}

export const pdfConverter = converter(
  "PDF",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const markdownChunks: string[] = [];
    let formPages = 0;
    let plainPages = 0;

    try {
      const WasmPdf = await initPdfplumber();
      const pdf = WasmPdf.open(new Uint8Array(ctx.buffer));

      for (let i = 0; i < pdf.pageCount; i++) {
        const page = pdf.page(i);
        const rawWords = page.extractWords(3, 3);
        const words = (rawWords as any[]).map(normalizeWord);
        const pageWidth = page.width || 612;

        const pageContent = extractFormContentFromWords(words, pageWidth);

        if (pageContent === null) {
          plainPages++;
          const text = page.extractText();
          if (text && text.trim()) markdownChunks.push(text.trim());
        } else {
          formPages++;
          if (pageContent.trim()) markdownChunks.push(pageContent);
        }
        page.free();
      }

      let markdown: string;
      if (plainPages > formPages && plainPages > 0) {
        // Use pdf-parse for plain text pages (better word spacing, like Python's pdfminer)
        pdf.free();
        markdown = await fallbackPdfParse(ctx.buffer);
      } else {
        pdf.free();
        markdown = markdownChunks.join("\n\n").trim();
      }

      if (!markdown.trim()) {
        markdown = await fallbackPdfParse(ctx.buffer);
      }

      return { markdown: mergePartialNumberingLines(markdown) };
    } catch {
      const markdown = await fallbackPdfParse(ctx.buffer);
      return { markdown: mergePartialNumberingLines(markdown) };
    }
  },
);

async function fallbackPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse(new Uint8Array(buffer));
  await parser.load();
  const result = await parser.getText();
  return result.text;
}
