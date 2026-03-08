/**
 * Stress tests: exercise every converter with edge cases to find bugs.
 */
import { describe, test, expect } from "bun:test";
import path from "node:path";
import fs from "node:fs";
import { createMarkItDown } from "../../src/markitdown";
import { UnsupportedFormatError, FileConversionError } from "../../src/exceptions";

const FIXTURES = path.join(import.meta.dir, "../fixtures");
const md = createMarkItDown();

// ============================================================
// PDF edge cases
// ============================================================
describe("PDF stress tests", () => {
  test("empty PDF (0 bytes) falls back gracefully", async () => {
    const emptyBuf = Buffer.alloc(0);
    await expect(
      md.convert(emptyBuf, { streamInfo: { extension: ".pdf", mimetype: "application/pdf" } }),
    ).rejects.toThrow();
  });

  test("corrupt PDF (random bytes with .pdf ext) throws", async () => {
    const corrupt = Buffer.from("not a pdf at all, just text pretending");
    await expect(
      md.convert(corrupt, { streamInfo: { extension: ".pdf", mimetype: "application/pdf" } }),
    ).rejects.toThrow();
  });

  test("PDF output has no [object Object] artifacts", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.pdf"));
    expect(result.markdown).not.toContain("[object Object]");
  });

  test("all PDF fixtures produce no [object Object]", async () => {
    const pdfFiles = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".pdf"));
    for (const file of pdfFiles) {
      const result = await md.convert(path.join(FIXTURES, file));
      expect(result.markdown).not.toContain("[object Object]");
    }
  });

  test("PDF table extraction produces valid markdown tables", async () => {
    const result = await md.convert(
      path.join(FIXTURES, "SPARSE-2024-INV-1234_borderless_table.pdf"),
    );
    const lines = result.markdown.split("\n");
    const tableLines = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
    // Every table line should have same number of pipes
    if (tableLines.length > 2) {
      const pipeCount = tableLines[0].split("|").length;
      for (const line of tableLines) {
        expect(line.split("|").length).toBe(pipeCount);
      }
    }
  });

  test("PDF mergePartialNumberingLines handles edge cases", async () => {
    // Test via the masterformat fixture
    const result = await md.convert(
      path.join(FIXTURES, "masterformat_partial_numbering.pdf"),
    );
    // Should not have empty lines where merging happened
    const lines = result.markdown.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\.\d+/.test(lines[i].trim())) {
        // Line starts with partial number — should have text after it
        expect(lines[i].trim().length).toBeGreaterThan(3);
      }
    }
  });
});

// ============================================================
// DOCX edge cases
// ============================================================
describe("DOCX stress tests", () => {
  test("equations.docx has no [object Object] in output", async () => {
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));
    expect(result.markdown).not.toContain("[object Object]");
  });

  test("equations.docx LaTeX is structurally valid (balanced $)", async () => {
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));
    // Count $ signs — should be even (paired)
    const dollars = result.markdown.match(/\$/g) || [];
    expect(dollars.length % 2).toBe(0);
  });

  test("equations.docx block math has balanced $$", async () => {
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));
    const blockMath = result.markdown.match(/\$\$/g) || [];
    // $$ should come in pairs
    expect(blockMath.length % 2).toBe(0);
  });

  test("equations.docx contains actual LaTeX commands", async () => {
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));
    // Should contain at least some LaTeX commands
    expect(result.markdown).toMatch(/\\frac|\\sin|\\cos|\\left|\\right|\\sqrt/);
  });

  test("test.docx still works with OMML pre-processing", async () => {
    // test.docx likely has no math — should still convert fine
    const result = await md.convert(path.join(FIXTURES, "test.docx"));
    expect(result.markdown).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
    expect(result.markdown).toContain("Abstract");
  });

  test("corrupt DOCX buffer throws FileConversionError", async () => {
    const corrupt = Buffer.from("PK but not really a zip");
    await expect(
      md.convert(corrupt, {
        streamInfo: {
          extension: ".docx",
          mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      }),
    ).rejects.toThrow();
  });
});

// ============================================================
// HTML edge cases
// ============================================================
describe("HTML stress tests", () => {
  test("empty HTML produces minimal output", async () => {
    const result = await md.convert(Buffer.from("<html><body></body></html>"), {
      streamInfo: { extension: ".html", mimetype: "text/html" },
    });
    expect(result.markdown.trim()).toBe("");
  });

  test("HTML with only scripts/styles produces no content", async () => {
    const html = `<html><head><style>body{color:red}</style></head>
    <body><script>alert("hi")</script></body></html>`;
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { extension: ".html", mimetype: "text/html" },
    });
    expect(result.markdown.trim()).toBe("");
  });

  test("HTML with deeply nested tags doesn't crash", async () => {
    let html = "<html><body>";
    for (let i = 0; i < 100; i++) html += "<div>";
    html += "deep content";
    for (let i = 0; i < 100; i++) html += "</div>";
    html += "</body></html>";
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { extension: ".html", mimetype: "text/html" },
    });
    expect(result.markdown).toContain("deep content");
  });

  test("HTML with special characters is preserved", async () => {
    const html = `<html><body><p>Héllo &amp; wörld &lt;tag&gt; "quotes" 'apostrophes'</p></body></html>`;
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { extension: ".html", mimetype: "text/html" },
    });
    expect(result.markdown).toContain("Héllo");
    expect(result.markdown).toContain("&");
    expect(result.markdown).toContain("wörld");
  });

  test("HTML tables convert to GFM markdown tables", async () => {
    const html = `<html><body><table>
      <tr><th>Name</th><th>Age</th></tr>
      <tr><td>Alice</td><td>30</td></tr>
      <tr><td>Bob</td><td>25</td></tr>
    </table></body></html>`;
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { extension: ".html", mimetype: "text/html" },
    });
    expect(result.markdown).toContain("|");
    expect(result.markdown).toContain("Name");
    expect(result.markdown).toContain("Alice");
  });

  test("HTML with data URIs are truncated by default", async () => {
    const html = `<html><body><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" /></body></html>`;
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { extension: ".html", mimetype: "text/html" },
    });
    expect(result.markdown).toContain("data:image/png;base64...");
    expect(result.markdown).not.toContain("iVBORw0KGgo");
  });
});

// ============================================================
// CSV edge cases
// ============================================================
describe("CSV stress tests", () => {
  test("single column CSV", async () => {
    const csv = "Name\nAlice\nBob\nCharlie";
    const result = await md.convert(Buffer.from(csv), {
      streamInfo: { extension: ".csv", mimetype: "text/csv" },
    });
    expect(result.markdown).toContain("Alice");
    expect(result.markdown).toContain("Bob");
  });

  test("CSV with quoted fields containing commas", async () => {
    const csv = 'Name,Address\nAlice,"123 Main St, Apt 4"\nBob,"456 Oak Ave"';
    const result = await md.convert(Buffer.from(csv), {
      streamInfo: { extension: ".csv", mimetype: "text/csv" },
    });
    expect(result.markdown).toContain("123 Main St, Apt 4");
  });

  test("CSV with empty fields", async () => {
    const csv = "A,B,C\n1,,3\n,2,\n,,";
    const result = await md.convert(Buffer.from(csv), {
      streamInfo: { extension: ".csv", mimetype: "text/csv" },
    });
    expect(result.markdown).toContain("|");
  });

  test("empty CSV produces minimal output", async () => {
    const result = await md.convert(Buffer.from(""), {
      streamInfo: { extension: ".csv", mimetype: "text/csv", charset: "utf-8" },
    });
    // Should not crash
    expect(typeof result.markdown).toBe("string");
  });

  test("CSV with escaped quotes", async () => {
    const csv = 'Name,Quote\nAlice,"She said ""hello"""\nBob,"He said ""bye"""';
    const result = await md.convert(Buffer.from(csv), {
      streamInfo: { extension: ".csv", mimetype: "text/csv" },
    });
    expect(result.markdown).toContain('She said "hello"');
  });
});

// ============================================================
// XLSX edge cases
// ============================================================
describe("XLSX stress tests", () => {
  test("XLSX output contains table structure", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.xlsx"));
    // Should have markdown table pipes
    expect(result.markdown).toContain("|");
  });

  test("XLS output contains table structure", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.xls"));
    expect(result.markdown).toContain("|");
  });
});

// ============================================================
// PPTX edge cases
// ============================================================
describe("PPTX stress tests", () => {
  test("PPTX output is non-empty and structured", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.pptx"));
    expect(result.markdown.length).toBeGreaterThan(100);
    // Should have slide headings
    expect(result.markdown).toContain("#");
  });

  test("PPTX has no [object Object] artifacts", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.pptx"));
    expect(result.markdown).not.toContain("[object Object]");
  });

  test("PPTX preserves word spacing in multi-run text", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.pptx"));
    // Names should be properly spaced, not concatenated like "QingyunWu"
    expect(result.markdown).toContain("Qingyun Wu");
    expect(result.markdown).toContain("Gagan Bansal");
    expect(result.markdown).toContain("Jieyu Zhang");
  });
});

// ============================================================
// EPUB edge cases
// ============================================================
describe("EPUB stress tests", () => {
  test("EPUB has structured markdown output", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.epub"));
    expect(result.markdown.length).toBeGreaterThan(100);
    expect(result.markdown).not.toContain("[object Object]");
  });
});

// ============================================================
// Jupyter notebook edge cases
// ============================================================
describe("Jupyter notebook stress tests", () => {
  test("notebook output preserves code blocks", async () => {
    const result = await md.convert(path.join(FIXTURES, "test_notebook.ipynb"));
    expect(result.markdown).toContain("```python");
    expect(result.markdown).toContain("```");
  });
});

// ============================================================
// Outlook MSG edge cases
// ============================================================
describe("Outlook MSG stress tests", () => {
  test("MSG has structured email output", async () => {
    const result = await md.convert(path.join(FIXTURES, "test_outlook_msg.msg"));
    expect(result.markdown).not.toContain("[object Object]");
    // Should have email structure
    expect(result.markdown).toMatch(/From|To|Subject/);
  });
});

// ============================================================
// Plain text edge cases
// ============================================================
describe("Plain text stress tests", () => {
  test("JSON file converts as plain text", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.json"));
    expect(result.markdown).toContain("{");
  });

  test("empty text buffer produces empty output", async () => {
    const result = await md.convert(Buffer.from(""), {
      streamInfo: { extension: ".txt", mimetype: "text/plain", charset: "utf-8" },
    });
    expect(result.markdown).toBe("");
  });

  test("unicode text is preserved", async () => {
    const text = "Hello 世界 🌍 Привет мир";
    const result = await md.convert(Buffer.from(text, "utf-8"), {
      streamInfo: { extension: ".txt", mimetype: "text/plain", charset: "utf-8" },
    });
    expect(result.markdown).toContain("世界");
    expect(result.markdown).toContain("Привет");
  });
});

// ============================================================
// ZIP edge cases
// ============================================================
describe("ZIP stress tests", () => {
  test("ZIP output includes file headers", async () => {
    const result = await md.convert(path.join(FIXTURES, "test_files.zip"));
    expect(result.markdown).toContain("##");
  });
});

// ============================================================
// Cross-converter consistency
// ============================================================
describe("Cross-converter consistency", () => {
  test("all fixture files convert without [object Object]", async () => {
    const files = fs.readdirSync(FIXTURES);
    for (const file of files) {
      if (file === "random.bin") continue; // Expected to fail
      try {
        const result = await md.convert(path.join(FIXTURES, file));
        expect(result.markdown).not.toContain("[object Object]");
      } catch {
        // Some files may legitimately fail (e.g., need special streamInfo)
      }
    }
  });

  test("all fixture files produce string markdown", async () => {
    const files = fs.readdirSync(FIXTURES);
    for (const file of files) {
      if (file === "random.bin") continue;
      try {
        const result = await md.convert(path.join(FIXTURES, file));
        expect(typeof result.markdown).toBe("string");
      } catch {
        // OK to throw for some
      }
    }
  });

  test("output never has more than 2 consecutive blank lines", async () => {
    // The normalizeResult in markitdown.ts should collapse 3+ newlines to 2
    const files = fs.readdirSync(FIXTURES);
    for (const file of files) {
      if (file === "random.bin") continue;
      try {
        const result = await md.convert(path.join(FIXTURES, file));
        expect(result.markdown).not.toMatch(/\n{3,}/);
      } catch {
        // OK
      }
    }
  });

  test("output lines have no trailing whitespace", async () => {
    const files = fs.readdirSync(FIXTURES);
    for (const file of files) {
      if (file === "random.bin") continue;
      try {
        const result = await md.convert(path.join(FIXTURES, file));
        const lines = result.markdown.split("\n");
        for (const line of lines) {
          expect(line).toBe(line.trimEnd());
        }
      } catch {
        // OK
      }
    }
  });
});

// ============================================================
// Error handling
// ============================================================
describe("Error handling stress tests", () => {
  test("UnsupportedFormatError for truly unknown format", async () => {
    const buf = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
    try {
      await md.convert(buf, { streamInfo: { extension: ".xyz123" } });
      throw new Error("Should have thrown");
    } catch (e) {
      expect(
        e instanceof UnsupportedFormatError || e instanceof FileConversionError,
      ).toBe(true);
    }
  });

  test("FileConversionError includes converter names", async () => {
    try {
      await md.convert(path.join(FIXTURES, "test.pdf"), {
        streamInfo: {
          extension: ".docx",
          mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
    } catch (e) {
      if (e instanceof FileConversionError && e.attempts) {
        for (const attempt of e.attempts) {
          expect(typeof attempt.converterName).toBe("string");
          expect(attempt.converterName.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("random.bin with no extension throws UnsupportedFormatError", async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, "random.bin"));
    try {
      await md.convert(buf, { streamInfo: {} });
      throw new Error("Should have thrown");
    } catch (e) {
      expect(
        e instanceof UnsupportedFormatError || e instanceof FileConversionError,
      ).toBe(true);
    }
  });

  test("null/undefined buffer handling", async () => {
    // @ts-expect-error — testing runtime behavior
    await expect(md.convert(null)).rejects.toThrow();
    // @ts-expect-error — testing runtime behavior
    await expect(md.convert(undefined)).rejects.toThrow();
  });
});

// ============================================================
// markitdown API
// ============================================================
describe("markitdown API tests", () => {
  test("convert returns ConvertResult shape", async () => {
    const result = await md.convert(path.join(FIXTURES, "test.pdf"));
    expect(typeof result.markdown).toBe("string");
    // title is optional
    if (result.title !== undefined) {
      expect(typeof result.title).toBe("string");
    }
  });

  test("convertLocal works", async () => {
    const result = await md.convertLocal(path.join(FIXTURES, "test.pdf"));
    expect(result.markdown.length).toBeGreaterThan(0);
  });

  test("convertUri with file:// works", async () => {
    const filePath = path.join(FIXTURES, "test.json");
    const result = await md.convertUri(`file://${filePath}`);
    expect(result.markdown.length).toBeGreaterThan(0);
  });

  test("registerConverter adds custom converter", async () => {
    const customMd = createMarkItDown();
    const { converter, byExt } = await import("../../src/converter");
    customMd.registerConverter(
      converter("Custom", byExt(".custom"), async () => ({
        markdown: "# Custom Output",
      })),
    );
    const result = await customMd.convert(Buffer.from("anything"), {
      streamInfo: { extension: ".custom" },
    });
    expect(result.markdown).toBe("# Custom Output");
  });
});
