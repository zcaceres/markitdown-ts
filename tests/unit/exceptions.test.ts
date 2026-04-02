import { describe, expect, test } from "bun:test";
import {
  FileConversionError,
  MarkItDownError,
  MissingDependencyError,
  UnsupportedFormatError,
} from "../../src/exceptions";

describe("exceptions", () => {
  test("MarkItDownError is instanceof Error", () => {
    const err = new MarkItDownError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("MarkItDownError");
    expect(err.message).toBe("test");
  });

  test("MissingDependencyError extends MarkItDownError", () => {
    const err = new MissingDependencyError("missing lib");
    expect(err).toBeInstanceOf(MarkItDownError);
    expect(err.name).toBe("MissingDependencyError");
  });

  test("UnsupportedFormatError extends MarkItDownError", () => {
    const err = new UnsupportedFormatError("no converter");
    expect(err).toBeInstanceOf(MarkItDownError);
    expect(err.name).toBe("UnsupportedFormatError");
  });

  test("FileConversionError generates message from attempts", () => {
    const err = new FileConversionError(undefined, [
      {
        converterName: "TestConverter",
        error: new Error("something broke"),
      },
    ]);
    expect(err).toBeInstanceOf(MarkItDownError);
    expect(err.message).toContain("TestConverter");
    expect(err.message).toContain("something broke");
    expect(err.attempts).toHaveLength(1);
  });

  test("FileConversionError with no attempts", () => {
    const err = new FileConversionError();
    expect(err.message).toBe("File conversion failed.");
  });
});
