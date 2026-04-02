import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("PPTX converter", () => {
  test("converts test.pptx", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test.pptx"));

    // Must include UUIDs
    expect(result.markdown).toContain("2cdda5c8-e50e-4db4-b5f0-9722a649f455");
    expect(result.markdown).toContain("04191ea8-5c73-4215-a1d3-1cfb43aaaf12");
    expect(result.markdown).toContain("44bf7d06-5e7a-4a40-a2e1-a2e42ef28c8a");
    expect(result.markdown).toContain("1b92870d-e3b5-4e65-8153-919f4ff45592");

    // Title
    expect(result.markdown).toContain("AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation");

    // Chart data
    expect(result.markdown).toContain("a3f6004b-6f4f-4ea8-bee3-3741f4dc385f");
    expect(result.markdown).toContain("2003");

    // Image with alt text caption
    expect(result.markdown).toContain("![This phrase of the caption is Human-written.]");

    // Must not include base64 image data
    expect(result.markdown).not.toContain("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE");
  });
});
