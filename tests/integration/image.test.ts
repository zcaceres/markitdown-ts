import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

async function hasExiftool(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "exiftool"], { stdout: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

describe("Image converter", () => {
  test("converts image file (no exiftool)", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.jpg"));
    expect(result).toBeDefined();
    expect(typeof result.markdown).toBe("string");
  });

  test("accepts image buffer with mimetype", async () => {
    const md = createMarkItDown();
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.jpg"));
    const result = await md.convert(buffer, {
      streamInfo: { mimetype: "image/jpeg" },
    });
    expect(result).toBeDefined();
  });

  test("output has no [object Object] artifacts", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.jpg"));
    expect(result.markdown).not.toContain("[object Object]");
  });

  test("with exiftool extracts metadata", async () => {
    const available = await hasExiftool();
    if (!available) {
      console.log("Skipping: exiftool not on PATH");
      return;
    }
    const md = createMarkItDown({ exiftoolPath: "exiftool" });
    const result = await md.convert(path.join(FIXTURES, "test.jpg"));
    // Exiftool should produce some metadata output
    expect(result.markdown.length).toBeGreaterThan(0);
  });
});
