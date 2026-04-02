import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("HTML converter", () => {
  test("converts blog HTML", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_blog.html"), {
      streamInfo: {
        charset: "utf-8",
        url: "https://microsoft.github.io/autogen/blog/2023/04/21/LLM-tuning-math",
      },
    });

    expect(result.markdown).toContain("Large language models (LLMs) are powerful tools");
    expect(result.markdown).toContain("an example where high cost can easily prevent a generic complex");
  });

  test("converts HTML from buffer", async () => {
    const html = `<html><head><title>Test</title></head><body>
      <h1>Hello World</h1>
      <p>This is a <strong>test</strong> paragraph.</p>
      <script>alert("evil")</script>
    </body></html>`;

    const md = createMarkItDown();
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { mimetype: "text/html", extension: ".html" },
    });

    expect(result.markdown).toContain("# Hello World");
    expect(result.markdown).toContain("**test**");
    expect(result.markdown).not.toContain("alert");
    expect(result.title).toBe("Test");
  });

  test("truncates data URIs in images", async () => {
    const html = `<html><body>
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..." alt="test image">
    </body></html>`;

    const md = createMarkItDown();
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { mimetype: "text/html" },
    });

    expect(result.markdown).toContain("data:image/png;base64...");
    expect(result.markdown).not.toContain("iVBORw0KGgoAAAANSUhEUg");
  });

  test("keeps data URIs when option set", async () => {
    const html = `<html><body>
      <img src="data:image/png;base64,iVBORw0KGgo" alt="test">
    </body></html>`;

    const md = createMarkItDown({ keepDataUris: true });
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { mimetype: "text/html" },
    });

    expect(result.markdown).toContain("iVBORw0KGgo");
  });

  test("removes javascript links", async () => {
    const html = `<html><body>
      <a href="javascript:void(0)">Click me</a>
      <a href="https://example.com">Safe link</a>
    </body></html>`;

    const md = createMarkItDown();
    const result = await md.convert(Buffer.from(html), {
      streamInfo: { mimetype: "text/html" },
    });

    expect(result.markdown).not.toContain("javascript:");
    expect(result.markdown).toContain("[Safe link](https://example.com)");
  });
});
