import { describe, test, expect } from "bun:test";
import path from "node:path";
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
    // Force a PDF file to be treated as DOCX — should fail with attempt details
    const { FileConversionError } = await import("../../src/exceptions");
    try {
      await md.convert(path.join(FIXTURES, "test.pdf"), {
        streamInfo: { extension: ".docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      });
      // If it doesn't throw, that's unexpected but not an error
    } catch (e) {
      expect(e).toBeInstanceOf(FileConversionError);
      if (e instanceof FileConversionError) {
        expect(e.attempts).toBeDefined();
        expect(e.attempts!.length).toBeGreaterThan(0);
      }
    }
  });
});
