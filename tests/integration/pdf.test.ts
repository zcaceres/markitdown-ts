import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("PDF converter", () => {
  test("converts test.pdf", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.pdf"));
    expect(result.markdown).toContain(
      "While there is contemporaneous exploration of multi-agent approaches",
    );
  });
});
