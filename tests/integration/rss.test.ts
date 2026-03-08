import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("RSS converter", () => {
  test("converts RSS XML", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "test_rss.xml"),
      { streamInfo: { charset: "utf-8" } },
    );

    expect(result.markdown).toContain("# The Official Microsoft Blog");
    expect(result.markdown).toContain(
      "## Ignite 2024: Why nearly 70% of the Fortune 500 now use Microsoft 365 Copilot",
    );
    expect(result.markdown).toContain(
      "In the case of AI, it is absolutely true that the industry is moving incredibly fast",
    );

    // Must not contain raw XML tags
    expect(result.markdown).not.toContain("<rss");
    expect(result.markdown).not.toContain("<feed");
  });
});
