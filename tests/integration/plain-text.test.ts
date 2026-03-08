import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("PlainText converter", () => {
  test("converts JSON file", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.json"));

    expect(result.markdown).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
    expect(result.markdown).toContain("9700dc99-6685-40b4-9a3a-5e406dcb37f3");
  });

  test("converts plain text buffer with charset hint", async () => {
    const text = "Hello, World!";
    const buffer = Buffer.from(text, "utf-8");
    const md = createMarkItDown();
    const result = await md.convert(buffer, {
      streamInfo: { charset: "utf-8", mimetype: "text/plain" },
    });
    expect(result.markdown).toContain("Hello, World!");
  });

  test("converts buffer with text/* mimetype", async () => {
    const text = "Some markdown content";
    const buffer = Buffer.from(text);
    const md = createMarkItDown();
    const result = await md.convert(buffer, {
      streamInfo: { mimetype: "text/plain" },
    });
    expect(result.markdown).toContain("Some markdown content");
  });

  test("converts buffer with .md extension hint", async () => {
    const text = "# Title\n\nParagraph";
    const buffer = Buffer.from(text);
    const md = createMarkItDown();
    const result = await md.convert(buffer, {
      streamInfo: { extension: ".md" },
    });
    expect(result.markdown).toContain("# Title");
  });
});
