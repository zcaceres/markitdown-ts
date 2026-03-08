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
});
