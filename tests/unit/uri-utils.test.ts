import { describe, expect, test } from "bun:test";
import { fileUriToPath, parseDataUri } from "../../src/uri-utils";

describe("fileUriToPath", () => {
  test("converts file:///path to local path", () => {
    const result = fileUriToPath("file:///tmp/test.txt");
    expect(result.netloc).toBeNull();
    expect(result.path).toBe("/tmp/test.txt");
  });

  test("handles file://localhost/path", () => {
    const result = fileUriToPath("file://localhost/tmp/test.txt");
    expect(result.netloc).toBe("localhost");
    expect(result.path).toBe("/tmp/test.txt");
  });

  test("throws for non-file URIs", () => {
    expect(() => fileUriToPath("http://example.com")).toThrow("Not a file URL");
  });
});

describe("parseDataUri", () => {
  test("parses base64 data URI", () => {
    const uri = "data:text/plain;base64,SGVsbG8=";
    const result = parseDataUri(uri);
    expect(result.mimeType).toBe("text/plain");
    expect(result.data.toString()).toBe("Hello");
  });

  test("parses URI with charset", () => {
    const uri = "data:text/plain;charset=utf-8,Hello%20World";
    const result = parseDataUri(uri);
    expect(result.mimeType).toBe("text/plain");
    expect(result.attributes.charset).toBe("utf-8");
    expect(result.data.toString()).toBe("Hello World");
  });

  test("parses URI with no mime type", () => {
    const uri = "data:;base64,SGVsbG8=";
    const result = parseDataUri(uri);
    expect(result.mimeType).toBeNull();
    expect(result.data.toString()).toBe("Hello");
  });

  test("throws for non-data URIs", () => {
    expect(() => parseDataUri("http://example.com")).toThrow("Not a data URI");
  });

  test("throws for malformed data URI", () => {
    expect(() => parseDataUri("data:text/plain")).toThrow("missing ','");
  });
});
