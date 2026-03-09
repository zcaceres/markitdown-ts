import { describe, test, expect } from "bun:test";
import path from "node:path";
import fs from "node:fs";
import { createMarkItDown } from "../../src/markitdown";
import { GENERAL_TEST_VECTORS } from "../test-vectors";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("test vector parametrized tests", () => {
  for (const vector of GENERAL_TEST_VECTORS) {
    test(`converts ${vector.filename}`, async () => {
      const md = createMarkItDown();
      const streamInfo: any = {};
      if (vector.charset) streamInfo.charset = vector.charset;
      if (vector.mimetype) streamInfo.mimetype = vector.mimetype;
      if (vector.url) streamInfo.url = vector.url;

      const result = await md.convert(
        path.join(FIXTURES, vector.filename),
        Object.keys(streamInfo).length > 0 ? { streamInfo } : undefined,
      );

      for (const s of vector.mustInclude) {
        expect(result.markdown).toContain(s);
      }
      for (const s of vector.mustNotInclude) {
        expect(result.markdown).not.toContain(s);
      }
    });
  }
});

// ============================================================
// Stream input with full hints (Python: test_convert_stream_with_hints)
// ============================================================

describe("stream input with full hints", () => {
  for (const vector of GENERAL_TEST_VECTORS) {
    test(`buffer + full hints: ${vector.filename}`, async () => {
      const md = createMarkItDown();
      const buffer = fs.readFileSync(path.join(FIXTURES, vector.filename));
      const ext = path.extname(vector.filename);

      const streamInfo: any = { extension: ext };
      if (vector.mimetype) streamInfo.mimetype = vector.mimetype;
      if (vector.charset) streamInfo.charset = vector.charset;
      if (vector.url) streamInfo.url = vector.url;

      const result = await md.convert(buffer, { streamInfo });

      for (const s of vector.mustInclude) {
        expect(result.markdown).toContain(s);
      }
      for (const s of vector.mustNotInclude) {
        expect(result.markdown).not.toContain(s);
      }
    });
  }
});

// ============================================================
// Stream input with minimal hints (Python: test_convert_stream_without_hints)
// ============================================================

describe("stream input with minimal hints", () => {
  for (const vector of GENERAL_TEST_VECTORS) {
    test(`buffer + extension only: ${vector.filename}`, async () => {
      const md = createMarkItDown();
      const buffer = fs.readFileSync(path.join(FIXTURES, vector.filename));
      const ext = path.extname(vector.filename);

      const streamInfo: any = { extension: ext };
      // Only add charset and url when needed (some converters require them)
      if (vector.charset) streamInfo.charset = vector.charset;
      if (vector.url) streamInfo.url = vector.url;

      const result = await md.convert(buffer, { streamInfo });

      for (const s of vector.mustInclude) {
        expect(result.markdown).toContain(s);
      }
      for (const s of vector.mustNotInclude) {
        expect(result.markdown).not.toContain(s);
      }
    });
  }
});

// ============================================================
// Binary detection without hints
// ============================================================

describe("binary detection without hints", () => {
  test("detects DOCX from magic bytes alone", async () => {
    const md = createMarkItDown();
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.docx"));
    const result = await md.convert(buffer);
    expect(result.markdown).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
  });

  test("detects PDF from magic bytes alone", async () => {
    const md = createMarkItDown();
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.pdf"));
    const result = await md.convert(buffer);
    expect(result.markdown.length).toBeGreaterThan(0);
  });

  test("detects XLSX from magic bytes alone", async () => {
    const md = createMarkItDown();
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.xlsx"));
    const result = await md.convert(buffer);
    expect(result.markdown).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
  });
});

// ============================================================
// Convert edge cases
// ============================================================

describe("convert edge cases", () => {
  test("throws UnsupportedFormatError for unknown format", async () => {
    const md = createMarkItDown();
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    await expect(
      md.convert(buffer, { streamInfo: { extension: ".xyz" } }),
    ).rejects.toThrow();
  });

  test("converts data URI", async () => {
    const md = createMarkItDown();
    const text = "Hello from data URI";
    const encoded = Buffer.from(text).toString("base64");
    const result = await md.convert(`data:text/plain;base64,${encoded}`);
    expect(result.markdown).toContain("Hello from data URI");
  });

  test("converts file:// URI", async () => {
    const md = createMarkItDown();
    const filePath = path.join(FIXTURES, "test.json");
    const result = await md.convert(`file://${filePath}`);
    expect(result.markdown).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
  });

  test("throws UnsupportedFormatError for random.bin", async () => {
    const md = createMarkItDown();
    await expect(
      md.convert(path.join(FIXTURES, "random.bin")),
    ).rejects.toThrow();
  });

  test("throws FileConversionError with attempt details for wrong extension", async () => {
    const md = createMarkItDown();
    const { FileConversionError } = await import("../../src/exceptions");
    try {
      await md.convert(path.join(FIXTURES, "test.pdf"), {
        streamInfo: {
          extension: ".docx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
    } catch (e) {
      expect(e).toBeInstanceOf(FileConversionError);
      if (e instanceof FileConversionError) {
        expect(e.attempts).toBeDefined();
        expect(e.attempts!.length).toBeGreaterThan(0);
        // Validate attempt structure
        for (const attempt of e.attempts!) {
          expect(typeof attempt.converterName).toBe("string");
          expect(attempt.converterName.length).toBeGreaterThan(0);
          expect(attempt.error).toBeDefined();
        }
      }
    }
  });
});
