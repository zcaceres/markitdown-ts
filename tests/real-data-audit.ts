/**
 * Real-data audit: convert every fixture file and print a summary + markdown preview.
 * Run with: bun tests/real-data-audit.ts
 *
 * This is NOT a test suite — it's a visual inspection tool to verify output quality.
 */

import fs from "node:fs";
import path from "node:path";
import { createMarkItDown } from "../src/markitdown.js";

const FIXTURES_DIR = path.join(import.meta.dir, "fixtures");

// Map fixture files to expected converter
const FIXTURE_FILES = [
  "test.pdf",
  "masterformat_partial_numbering.pdf",
  "MEDRPT-2024-PAT-3847_medical_report_scan.pdf",
  "movie-theater-booking-2024.pdf",
  "RECEIPT-2024-TXN-98765_retail_purchase.pdf",
  "REPAIR-2022-INV-001_multipage.pdf",
  "SPARSE-2024-INV-1234_borderless_table.pdf",
  "test.docx",
  "test_with_comment.docx",
  "equations.docx",
  "test.pptx",
  "test.xlsx",
  "test.xls",
  "test.epub",
  "test_blog.html",
  "test_wikipedia.html",
  "test_serp.html",
  "test_rss.xml",
  "test_mskanji.csv",
  "test_notebook.ipynb",
  "test_outlook_msg.msg",
  "test.jpg",
  "test.mp3",
  "test_files.zip",
  "test.json",
];

const PREVIEW_LINES = 25;
const SEPARATOR = "═".repeat(80);
const THIN_SEP = "─".repeat(80);

async function main() {
  const md = createMarkItDown();
  const results: { file: string; status: string; chars: number; lines: number; preview: string; time: number }[] = [];

  console.log(`\n${SEPARATOR}`);
  console.log(`  MARKITDOWN-TS REAL DATA AUDIT`);
  console.log(`  Fixtures: ${FIXTURES_DIR}`);
  console.log(`${SEPARATOR}\n`);

  for (const file of FIXTURE_FILES) {
    const filePath = path.join(FIXTURES_DIR, file);
    if (!fs.existsSync(filePath)) {
      results.push({ file, status: "MISSING", chars: 0, lines: 0, preview: "", time: 0 });
      continue;
    }

    const start = performance.now();
    try {
      const result = await md.convert(filePath);
      const elapsed = performance.now() - start;
      const markdown = result.markdown;
      const lines = markdown.split("\n");
      const preview = lines.slice(0, PREVIEW_LINES).join("\n");
      const truncated = lines.length > PREVIEW_LINES ? `\n  ... (${lines.length - PREVIEW_LINES} more lines)` : "";

      results.push({
        file,
        status: "OK",
        chars: markdown.length,
        lines: lines.length,
        preview: preview + truncated,
        time: elapsed,
      });
    } catch (e: any) {
      const elapsed = performance.now() - start;
      results.push({
        file,
        status: `ERROR: ${e.message?.slice(0, 100)}`,
        chars: 0,
        lines: 0,
        preview: "",
        time: elapsed,
      });
    }
  }

  // Print detailed output for each file
  for (const r of results) {
    console.log(THIN_SEP);
    const badge = r.status === "OK" ? "✅" : r.status === "MISSING" ? "⚠️" : "❌";
    console.log(`${badge}  ${r.file}`);
    console.log(`   Status: ${r.status} | ${r.chars} chars | ${r.lines} lines | ${r.time.toFixed(0)}ms`);
    if (r.preview) {
      console.log("");
      // Indent preview
      for (const line of r.preview.split("\n")) {
        console.log(`   ${line}`);
      }
    }
    console.log("");
  }

  // Summary table
  console.log(SEPARATOR);
  console.log("  SUMMARY");
  console.log(SEPARATOR);
  console.log("");
  console.log(`  ${"File".padEnd(50)} ${"Status".padEnd(10)} ${"Chars".padEnd(8)} ${"Lines".padEnd(8)} Time`);
  console.log(`  ${"─".repeat(50)} ${"─".repeat(10)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(8)}`);
  for (const r of results) {
    const status = r.status === "OK" ? "OK" : r.status.startsWith("ERROR") ? "ERROR" : r.status;
    console.log(
      `  ${r.file.padEnd(50)} ${status.padEnd(10)} ${String(r.chars).padEnd(8)} ${String(r.lines).padEnd(8)} ${r.time.toFixed(0)}ms`,
    );
  }

  const ok = results.filter((r) => r.status === "OK").length;
  const errors = results.filter((r) => r.status.startsWith("ERROR")).length;
  const missing = results.filter((r) => r.status === "MISSING").length;
  console.log("");
  console.log(`  Total: ${results.length} | OK: ${ok} | Errors: ${errors} | Missing: ${missing}`);
  console.log("");

  // Flag suspicious results
  const suspicious = results.filter((r) => r.status === "OK" && (r.chars < 10 || r.lines < 2));
  if (suspicious.length) {
    console.log("  ⚠️  SUSPICIOUSLY SHORT OUTPUT:");
    for (const s of suspicious) {
      console.log(`     ${s.file}: ${s.chars} chars, ${s.lines} lines`);
    }
    console.log("");
  }

  // Flag very slow conversions
  const slow = results.filter((r) => r.time > 5000);
  if (slow.length) {
    console.log("  🐌 SLOW CONVERSIONS (>5s):");
    for (const s of slow) {
      console.log(`     ${s.file}: ${s.time.toFixed(0)}ms`);
    }
    console.log("");
  }
}

main().catch(console.error);
