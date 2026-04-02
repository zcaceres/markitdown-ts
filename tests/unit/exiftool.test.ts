import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { exiftoolMetadata } from "../../src/converters/exiftool";

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

describe("exiftoolMetadata", () => {
  test("returns empty object when exiftoolPath is undefined", async () => {
    const result = await exiftoolMetadata(Buffer.from("test"), undefined);
    expect(result).toEqual({});
  });

  test("throws for nonexistent exiftool path", async () => {
    await expect(exiftoolMetadata(Buffer.from("test"), "/nonexistent/exiftool")).rejects.toThrow(
      "Failed to verify ExifTool version.",
    );
  });

  test("with real exiftool returns non-empty record for test.jpg", async () => {
    const available = await hasExiftool();
    if (!available) {
      console.log("Skipping: exiftool not on PATH");
      return;
    }
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.jpg"));
    const result = await exiftoolMetadata(buffer, "exiftool");
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });
});
