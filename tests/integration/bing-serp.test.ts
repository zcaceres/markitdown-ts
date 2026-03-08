import { describe, test, expect } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("Bing SERP converter", () => {
  test("converts Bing search results", async () => {
    const md = createMarkItDown();
    const result = await md.convert(
      path.join(FIXTURES, "test_serp.html"),
      {
        streamInfo: {
          charset: "utf-8",
          url: "https://www.bing.com/search?q=microsoft+wikipedia",
        },
      },
    );

    expect(result.markdown).toContain(
      "](https://en.wikipedia.org/wiki/Microsoft",
    );
    expect(result.markdown).toContain(
      "Microsoft Corporation is **an American multinational corporation and technology company headquartered** in Redmond",
    );
    expect(result.markdown).toContain(
      "1995–2007: Foray into the Web, Windows 95, Windows XP, and Xbox",
    );

    // Must not contain Bing tracking URLs
    expect(result.markdown).not.toContain("https://www.bing.com/ck/a?!&&p=");
    // Must not contain SVG data URIs
    expect(result.markdown).not.toContain(
      "data:image/svg+xml,%3Csvg%20width%3D",
    );
  });
});
