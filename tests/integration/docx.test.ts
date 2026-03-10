import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("DOCX converter", () => {
  test("converts test.docx", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.docx"));

    // Must include UUIDs
    expect(result.markdown).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
    expect(result.markdown).toContain("49e168b7-d2ae-407f-a055-2167576f39a1");

    // Must include headings
    expect(result.markdown).toContain("Abstract");
    expect(result.markdown).toContain("Introduction");
    expect(result.markdown).toContain(
      "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation",
    );

    // Data URIs should be truncated
    expect(result.markdown).toContain("data:image/png;base64...");
    expect(result.markdown).not.toContain(
      "data:image/png;base64,iVBORw0KGgoAAAANSU",
    );
  });

  test("converts test.docx with keep_data_uris", async () => {
    const md = createMarkItDown({ keepDataUris: true });
    const result = await md.convert(path.join(FIXTURES, "test.docx"));
    expect(result.markdown).toContain(
      "data:image/png;base64,iVBORw0KGgoAAAANSU",
    );
    expect(result.markdown).not.toContain("data:image/png;base64...");
  });

  test("converts equations.docx with inline LaTeX", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));
    // Should contain inline math markers
    expect(result.markdown).toContain("$");
    // Should contain specific equation content like m=1
    expect(result.markdown).toMatch(/\$.*m.*=.*1.*\$/);
  });

  test("converts equations.docx with block LaTeX", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));
    // Should contain block math markers $$...$$
    expect(result.markdown).toMatch(/\$\$.*\$\$/);
  });

  test("converts test_with_comment.docx with styleMap", async () => {
    const md = createMarkItDown({ styleMap: "comment-reference => " });
    const result = await md.convert(
      path.join(FIXTURES, "test_with_comment.docx"),
    );
    // Should contain the comment text
    expect(result.markdown).toContain("This is a test comment. 12df-321a");
    expect(result.markdown).toContain("55yiyi-asd09");
  });
});

describe("DOCX equation detailed tests", () => {
  test("equations.docx contains specific LaTeX commands", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));

    // Should contain specific LaTeX commands from the physics equations
    expect(result.markdown).toContain("\\frac");
    expect(result.markdown).toContain("sin");

    // Should contain specific numeric values from the equations
    expect(result.markdown).toMatch(/550/);
    expect(result.markdown).toMatch(/2\.5/);
  });

  test("equations.docx inline equations have paired delimiters", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "equations.docx"));

    // Find all $ that are not $$ (inline delimiters)
    // Replace $$ with placeholder, then count remaining $
    const withoutBlock = result.markdown.replace(/\$\$/g, "");
    const inlineDollars = (withoutBlock.match(/\$/g) || []).length;
    expect(inlineDollars % 2).toBe(0);
  });

  test("test.docx has no math delimiters (no equations)", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.docx"));

    // test.docx has no equations, so no $ math markers should appear
    // ($ might appear in text context, so check for LaTeX-style patterns)
    expect(result.markdown).not.toMatch(/\$\\frac/);
    expect(result.markdown).not.toMatch(/\$\$/);
  });
});
