import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("ZIP converter", () => {
  test("converts ZIP archive with nested files", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_files.zip"));

    // UUIDs from various contained files
    expect(result.markdown).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
    expect(result.markdown).toContain("49e168b7-d2ae-407f-a055-2167576f39a1");
    expect(result.markdown).toContain(
      "## d666f1f7-46cb-42bd-9a39-9a39cf2a509f",
    );
    expect(result.markdown).toContain("# Abstract");
    expect(result.markdown).toContain("# Introduction");
    expect(result.markdown).toContain(
      "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation",
    );
    expect(result.markdown).toContain("2cdda5c8-e50e-4db4-b5f0-9722a649f455");
    expect(result.markdown).toContain("04191ea8-5c73-4215-a1d3-1cfb43aaaf12");
    expect(result.markdown).toContain("44bf7d06-5e7a-4a40-a2e1-a2e42ef28c8a");
    expect(result.markdown).toContain("1b92870d-e3b5-4e65-8153-919f4ff45592");
    expect(result.markdown).toContain("## 09060124-b5e7-4717-9d07-3c046eb");
    expect(result.markdown).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
    expect(result.markdown).toContain("affc7dad-52dc-4b98-9b5d-51e65d8a8ad0");
    expect(result.markdown).toContain(
      "Microsoft entered the operating system (OS) business in 1980 with its own version of [Unix]",
    );
    expect(result.markdown).toContain(
      'Microsoft was founded by [Bill Gates](/wiki/Bill_Gates "Bill Gates")',
    );
  });
});
