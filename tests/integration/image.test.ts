import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("Image converter", () => {
  test("converts image file (no exiftool)", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.jpg"));
    // Without exiftool, should return empty markdown (no metadata)
    expect(result).toBeDefined();
    expect(typeof result.markdown).toBe("string");
  });

  test("accepts image buffer with mimetype", async () => {
    const md = createMarkItDown();
    const fs = await import("node:fs");
    const buffer = await fs.promises.readFile(
      path.join(FIXTURES, "test.jpg"),
    );
    const result = await md.convert(buffer, {
      streamInfo: { mimetype: "image/jpeg" },
    });
    expect(result).toBeDefined();
  });
});
