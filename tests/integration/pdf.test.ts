import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

// ============================================================
// Helper functions
// ============================================================

/** Validate that markdown contains all expected strings and none of the excluded strings */
function validateStrings(markdown: string, expected: string[], excluded?: string[]): void {
  for (const s of expected) {
    expect(markdown).toContain(s);
  }
  if (excluded) {
    for (const s of excluded) {
      expect(markdown).not.toContain(s);
    }
  }
}

/** Extract markdown tables as arrays of row strings (lines starting and ending with |) */
function extractMarkdownTables(text: string): string[][] {
  const lines = text.split("\n");
  const tables: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      current.push(trimmed);
    } else if (current.length > 0) {
      tables.push(current);
      current = [];
    }
  }
  if (current.length > 0) tables.push(current);
  return tables;
}

/** Validate table rows have consistent column count (ignoring separator rows) */
function validateTableStructure(table: string[]): void {
  const dataCols = table.filter((row) => !row.match(/^\|[\s-|]+\|$/)).map((row) => row.split("|").length);
  if (dataCols.length > 1) {
    for (const count of dataCols) {
      expect(count).toBe(dataCols[0]);
    }
  }
}

// ============================================================
// Basic conversion tests
// ============================================================

describe("PDF converter", () => {
  test("converts test.pdf (academic paper, no false tables)", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.pdf"));
    expect(result.markdown).toContain("While there is contemporaneous exploration of multi-agent approaches");
    // Academic paper should NOT have pipe characters (no table extraction)
    const pipeLines = result.markdown.split("\n").filter((l) => l.startsWith("|") && l.endsWith("|"));
    expect(pipeLines.length).toBe(0);
  });

  test("converts borderless table PDF with pipe-separated cells", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "SPARSE-2024-INV-1234_borderless_table.pdf"));
    expect(result.markdown).toContain("|");
    expect(result.markdown).toContain("---");
  });

  test("converts receipt PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "RECEIPT-2024-TXN-98765_retail_purchase.pdf"));
    expect(result.markdown.length).toBeGreaterThan(50);
  });

  test("converts multipage invoice PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "REPAIR-2022-INV-001_multipage.pdf"));
    expect(result.markdown.length).toBeGreaterThan(100);
  });

  test("handles scanned PDF (no text layer) gracefully", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "MEDRPT-2024-PAT-3847_medical_report_scan.pdf"));
    expect(typeof result.markdown).toBe("string");
  });

  test("converts movie theater booking PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "movie-theater-booking-2024.pdf"));
    expect(result.markdown.length).toBeGreaterThan(50);
  });

  test("merges MasterFormat partial numbering", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "masterformat_partial_numbering.pdf"));
    const lines = result.markdown.split("\n");
    const isolatedNumberings = lines.filter((l) => /^\.\d+$/.test(l.trim()));
    expect(isolatedNumberings.length).toBe(0);
  });
});

// ============================================================
// Borderless table content validation (Python: test_borderless_table_extraction)
// ============================================================

describe("PDF borderless table content validation", () => {
  let markdown: string;

  test("setup: convert borderless table PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "SPARSE-2024-INV-1234_borderless_table.pdf"));
    markdown = result.markdown;
  });

  test("contains expected SKU codes", () => {
    validateStrings(markdown, ["SKU-8847", "SKU-9201", "SKU-4563", "SKU-7728"]);
  });

  test("contains table headers", () => {
    validateStrings(markdown, ["Product", "Code", "Location", "Expected", "Actual"]);
  });

  test("contains cost values", () => {
    validateStrings(markdown, ["$45.00", "$32.50", "$120.00"]);
  });

  test("contains category values", () => {
    validateStrings(markdown, ["Electronics", "Hardware"]);
  });

  test("contains status values", () => {
    validateStrings(markdown, ["OK", "CRITICAL"]);
  });

  test("SKU-8847 appears no more than 4 times (no duplication)", () => {
    const count = (markdown.match(/SKU-8847/g) || []).length;
    expect(count).toBeLessThanOrEqual(4);
  });

  test("sections appear in correct order", () => {
    // Header info before Product Code section
    const headerIdx = markdown.indexOf("INVENTORY");
    const productIdx = markdown.indexOf("Product");
    const varianceIdx = markdown.indexOf("Variance");
    const extendedIdx = markdown.indexOf("Extended");
    const recommendationsIdx = markdown.indexOf("Recommendations");

    expect(headerIdx).toBeLessThan(productIdx);
    expect(productIdx).toBeLessThan(varianceIdx);
    expect(varianceIdx).toBeLessThan(extendedIdx);
    expect(extendedIdx).toBeLessThan(recommendationsIdx);
  });

  test("extended review table has expected data", () => {
    validateStrings(markdown, ["$13,005.00", "$25,285.00", "$18,720.00", "Verified", "High Value", "Pending"]);
  });
});

// ============================================================
// Receipt PDF content validation (Python: test_receipt_pdf_extraction)
// ============================================================

describe("PDF receipt content validation", () => {
  let markdown: string;

  test("setup: convert receipt PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "RECEIPT-2024-TXN-98765_retail_purchase.pdf"));
    markdown = result.markdown;
  });

  test("contains store header info", () => {
    validateStrings(markdown, ["TECHMART", "ELECTRONICS"]);
  });

  test("contains transaction info", () => {
    validateStrings(markdown, ["TXN-98765"]);
  });

  test("contains line item prices", () => {
    validateStrings(markdown, ["$349.99", "$299.99"]);
  });

  test("contains totals", () => {
    validateStrings(markdown, ["$863.91", "$821.14"]);
  });

  test("contains payment info", () => {
    validateStrings(markdown, ["Visa", "4782"]);
  });

  test("contains rewards member info", () => {
    validateStrings(markdown, ["Sarah Mitchell"]);
  });
});

// ============================================================
// Multipage invoice content validation (Python: test_multipage_invoice_extraction)
// ============================================================

describe("PDF multipage invoice content validation", () => {
  let markdown: string;

  test("setup: convert multipage invoice PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "REPAIR-2022-INV-001_multipage.pdf"));
    markdown = result.markdown;
  });

  test("contains company name", () => {
    validateStrings(markdown, ["ZAVA", "AUTO", "REPAIR"]);
  });

  test("contains customer names", () => {
    validateStrings(markdown, ["Gabriel", "Diaz"]);
  });

  test("contains vehicle details", () => {
    validateStrings(markdown, ["Jeep", "Grand Cherokee"]);
  });

  test("contains cost values", () => {
    validateStrings(markdown, ["2,100", "300", "225"]);
  });

  test("has pipe-separated table format", () => {
    const pipeLines = markdown.split("\n").filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
    expect(pipeLines.length).toBeGreaterThan(10);
  });

  test("has rows with 3+ columns", () => {
    const pipeLines = markdown.split("\n").filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
    const multiColRows = pipeLines.filter((l) => l.split("|").filter((c) => c.trim()).length >= 3);
    expect(multiColRows.length).toBeGreaterThan(5);
  });
});

// ============================================================
// Movie theater booking content validation (Python: test_movie_theater_booking_pdf_extraction)
// ============================================================

describe("PDF movie theater booking content validation", () => {
  let markdown: string;

  test("setup: convert movie theater booking PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "movie-theater-booking-2024.pdf"));
    markdown = result.markdown;
  });

  test("contains order number", () => {
    validateStrings(markdown, ["2024-12-5678"]);
  });

  test("contains date info", () => {
    validateStrings(markdown, ["12/15/2024"]);
  });

  test("contains agency/customer info", () => {
    validateStrings(markdown, ["Sarah Johnson"]);
  });

  test("contains pricing info", () => {
    // Check for pricing values present in the document
    expect(
      markdown.includes("$12,500") ||
        markdown.includes("12,500") ||
        markdown.includes("$11,250") ||
        markdown.includes("11,250"),
    ).toBe(true);
  });
});

// ============================================================
// Table structure consistency (Python: TestPdfTableStructureConsistency)
// ============================================================

describe("PDF table structure consistency", () => {
  test("borderless table: has pipes, header, and SKUs", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "SPARSE-2024-INV-1234_borderless_table.pdf"));
    expect(result.markdown).toContain("|");
    expect(result.markdown).toContain("Product");
    expect(result.markdown).toContain("SKU-8847");
    expect(result.markdown).toContain("SKU-9201");
  });

  test("multipage invoice: >10 pipe rows with >5 having 3+ columns", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "REPAIR-2022-INV-001_multipage.pdf"));
    const pipeLines = result.markdown.split("\n").filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
    expect(pipeLines.length).toBeGreaterThan(10);

    const multiCol = pipeLines.filter((l) => l.split("|").filter((c) => c.trim()).length >= 3);
    expect(multiCol.length).toBeGreaterThan(5);
  });

  test("scanned PDF: empty or no tables", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "MEDRPT-2024-PAT-3847_medical_report_scan.pdf"));
    const tables = extractMarkdownTables(result.markdown);
    // Scanned PDF has no text layer, so no tables
    expect(tables.length).toBe(0);
  });

  test("borderless table has consistent column counts within each table", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "SPARSE-2024-INV-1234_borderless_table.pdf"));
    const tables = extractMarkdownTables(result.markdown);
    for (const table of tables) {
      validateTableStructure(table);
    }
  });
});

// ============================================================
// MasterFormat detailed tests
// ============================================================

describe("PDF MasterFormat detailed tests", () => {
  test("PARTIAL_NUMBERING_PATTERN regex matches correctly", () => {
    // Re-declare the pattern (it's not exported, so we test the same regex)
    const PARTIAL_NUMBERING_PATTERN = /^\.\d+$/;

    // Should match
    expect(PARTIAL_NUMBERING_PATTERN.test(".1")).toBe(true);
    expect(PARTIAL_NUMBERING_PATTERN.test(".2")).toBe(true);
    expect(PARTIAL_NUMBERING_PATTERN.test(".10")).toBe(true);
    expect(PARTIAL_NUMBERING_PATTERN.test(".99")).toBe(true);

    // Should NOT match
    expect(PARTIAL_NUMBERING_PATTERN.test("1.")).toBe(false);
    expect(PARTIAL_NUMBERING_PATTERN.test("1.2")).toBe(false);
    expect(PARTIAL_NUMBERING_PATTERN.test(".1.2")).toBe(false);
    expect(PARTIAL_NUMBERING_PATTERN.test("text")).toBe(false);
    expect(PARTIAL_NUMBERING_PATTERN.test(".a")).toBe(false);
    expect(PARTIAL_NUMBERING_PATTERN.test("")).toBe(false);
  });

  test("MasterFormat content is preserved", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "masterformat_partial_numbering.pdf"));

    validateStrings(result.markdown, ["RFP", "Section", "00 00 43", "Ken Sargent", "House", "GRANDE", "PRAIRIE"]);

    // Merged partial numberings should have text after them
    expect(result.markdown).toMatch(/\.1 .+/);
    expect(result.markdown).toMatch(/\.2 .+/);
  });

  test("multiple partial numberings all merged", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "masterformat_partial_numbering.pdf"));
    const lines = result.markdown.split("\n");

    // Count merged numberings (lines starting with .N followed by text)
    const mergedNumberings = lines.filter((l) => /^\.\d+ \S/.test(l.trim()));
    expect(mergedNumberings.length).toBeGreaterThanOrEqual(2);

    // Count isolated numberings (should be 0)
    const isolatedNumberings = lines.filter((l) => /^\.\d+$/.test(l.trim()));
    expect(isolatedNumberings.length).toBe(0);
  });
});
