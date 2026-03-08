import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("EPUB converter", () => {
  test("converts EPUB with metadata and chapters", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.epub"));

    // Metadata
    expect(result.markdown).toContain("**Authors:** Test Author");

    // Content
    expect(result.markdown).toContain(
      "A test EPUB document for MarkItDown testing",
    );
    expect(result.markdown).toContain("# Chapter 1: Test Content");
    expect(result.markdown).toContain(
      "This is a **test** paragraph with some formatting",
    );
    expect(result.markdown).toContain("* A bullet point");
    expect(result.markdown).toContain("* Another point");
    expect(result.markdown).toContain("# Chapter 2: More Content");
    expect(result.markdown).toContain("*different*");
    expect(result.markdown).toContain(
      "> This is a blockquote for testing",
    );
  });

  test("extracts title from metadata", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.epub"));
    // Title should be extracted from dc:title metadata
    expect(result.title).toBeTruthy();
  });
});
