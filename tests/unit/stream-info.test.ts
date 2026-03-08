import { describe, test, expect } from "bun:test";
import { mergeStreamInfo, guessMimeFromExtension, guessExtensionFromMime } from "../../src/stream-info";

describe("mergeStreamInfo", () => {
  test("returns base when no overrides", () => {
    const base = { mimetype: "text/plain", extension: ".txt" };
    expect(mergeStreamInfo(base)).toEqual(base);
  });

  test("overrides defined fields", () => {
    const base = { mimetype: "text/plain", extension: ".txt" };
    const override = { mimetype: "text/html" };
    const result = mergeStreamInfo(base, override);
    expect(result.mimetype).toBe("text/html");
    expect(result.extension).toBe(".txt");
  });

  test("does not override with undefined", () => {
    const base = { mimetype: "text/plain", extension: ".txt" };
    const override = { mimetype: undefined };
    const result = mergeStreamInfo(base, override);
    expect(result.mimetype).toBe("text/plain");
  });

  test("merges multiple overrides in order", () => {
    const base = { mimetype: "text/plain" };
    const result = mergeStreamInfo(
      base,
      { charset: "utf-8" },
      { mimetype: "text/html", filename: "test.html" },
    );
    expect(result.mimetype).toBe("text/html");
    expect(result.charset).toBe("utf-8");
    expect(result.filename).toBe("test.html");
  });

  test("skips undefined overrides", () => {
    const base = { mimetype: "text/plain" };
    const result = mergeStreamInfo(base, undefined);
    expect(result.mimetype).toBe("text/plain");
  });
});

describe("guessMimeFromExtension", () => {
  test("returns mime for known extensions", () => {
    expect(guessMimeFromExtension(".pdf")).toBe("application/pdf");
    expect(guessMimeFromExtension(".html")).toBe("text/html");
    expect(guessMimeFromExtension(".json")).toBe("application/json");
  });

  test("returns undefined for unknown extensions", () => {
    expect(guessMimeFromExtension(".xyz")).toBeUndefined();
  });

  test("is case insensitive", () => {
    expect(guessMimeFromExtension(".PDF")).toBe("application/pdf");
  });
});

describe("guessExtensionFromMime", () => {
  test("returns extension for known mimes", () => {
    expect(guessExtensionFromMime("application/pdf")).toBe(".pdf");
    expect(guessExtensionFromMime("text/html")).toBe(".html");
  });

  test("returns undefined for unknown mimes", () => {
    expect(guessExtensionFromMime("application/x-custom")).toBeUndefined();
  });
});
