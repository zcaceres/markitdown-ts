import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("PDF converter", () => {
  test("converts test.pdf (academic paper, no false tables)", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.pdf"));
    expect(result.markdown).toContain(
      "While there is contemporaneous exploration of multi-agent approaches",
    );
    // Academic paper should NOT have pipe characters (no table extraction)
    const pipeLines = result.markdown
      .split("\n")
      .filter((l) => l.startsWith("|") && l.endsWith("|"));
    expect(pipeLines.length).toBe(0);
  });

  test("converts borderless table PDF with pipe-separated cells", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "SPARSE-2024-INV-1234_borderless_table.pdf"),
    );
    // Should contain pipe characters indicating table extraction
    expect(result.markdown).toContain("|");
    // Should contain table header separator
    expect(result.markdown).toContain("---");
  });

  test("converts receipt PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "RECEIPT-2024-TXN-98765_retail_purchase.pdf"),
    );
    // Should have some content from the receipt
    expect(result.markdown.length).toBeGreaterThan(50);
  });

  test("converts multipage invoice PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "REPAIR-2022-INV-001_multipage.pdf"),
    );
    expect(result.markdown.length).toBeGreaterThan(100);
  });

  test("handles scanned PDF (no text layer) gracefully", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "MEDRPT-2024-PAT-3847_medical_report_scan.pdf"),
    );
    // Scanned PDF should produce empty or minimal output (no text layer)
    // Just verify it doesn't throw
    expect(typeof result.markdown).toBe("string");
  });

  test("converts movie theater booking PDF", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "movie-theater-booking-2024.pdf"),
    );
    expect(result.markdown.length).toBeGreaterThan(50);
  });

  test("merges MasterFormat partial numbering", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "masterformat_partial_numbering.pdf"),
    );
    // Partial numbering should be merged with text, not on separate lines
    const lines = result.markdown.split("\n");
    // No line should be ONLY a partial numbering like ".1" or ".2"
    const isolatedNumberings = lines.filter((l) => /^\.\d+$/.test(l.trim()));
    expect(isolatedNumberings.length).toBe(0);
  });
});
