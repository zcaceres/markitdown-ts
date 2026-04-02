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

describe("Audio converter", () => {
  test("converts mp3 file without exiftool (no crash)", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.mp3"));
    expect(result).toBeDefined();
    expect(typeof result.markdown).toBe("string");
  });

  test("converts mp3 buffer with mimetype hint", async () => {
    const md = createMarkItDown();
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.mp3"));
    const result = await md.convert(buffer, {
      streamInfo: { mimetype: "audio/mpeg" },
    });
    expect(result).toBeDefined();
    expect(typeof result.markdown).toBe("string");
  });

  test("with exiftool extracts metadata", async () => {
    const available = await hasExiftool();
    if (!available) {
      console.log("Skipping: exiftool not on PATH");
      return;
    }
    const md = createMarkItDown({ exiftoolPath: "exiftool" });
    const result = await md.convert(path.join(FIXTURES, "test.mp3"));
    expect(result.markdown.length).toBeGreaterThan(0);
  });
});
