import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("XLSX converter", () => {
  test("converts test.xlsx", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.xlsx"));

    expect(result.markdown).toContain("09060124-b5e7-4717-9d07-3c046eb");
    expect(result.markdown).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
    expect(result.markdown).toContain("affc7dad-52dc-4b98-9b5d-51e65d8a8ad0");
  });
});

describe("XLS converter", () => {
  test("converts test.xls", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.xls"));

    expect(result.markdown).toContain("09060124-b5e7-4717-9d07-3c046eb");
    expect(result.markdown).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
    expect(result.markdown).toContain("affc7dad-52dc-4b98-9b5d-51e65d8a8ad0");
  });
});
