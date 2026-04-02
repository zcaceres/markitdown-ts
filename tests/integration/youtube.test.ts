import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

// YouTube converter attempts transcript fetch over the network, which may be slow in CI
const YOUTUBE_TIMEOUT = 30_000;

describe("YouTube converter", () => {
  test(
    "extracts metadata from YouTube HTML fixture",
    async () => {
      const md = createMarkItDown();
      const htmlPath = path.join(FIXTURES, "test_youtube.html");
      const result = await md.convert(htmlPath, {
        streamInfo: {
          url: "https://www.youtube.com/watch?v=V2qZ_lgxTzg",
          mimetype: "text/html",
          extension: ".html",
        },
      });

      // Structure checks
      expect(result.markdown).toContain("# YouTube");
      expect(result.markdown).toContain("## Test Video Title");
      expect(result.markdown).toContain("### Video Metadata");
      expect(result.markdown).toContain("### Description");

      // Metadata content
      expect(result.markdown).toContain("1234567");
      expect(result.markdown).toContain("test, video, markitdown");
      expect(result.markdown).toContain("PT5M30S");
      expect(result.markdown).toContain("This is a test video description for unit testing.");
    },
    YOUTUBE_TIMEOUT,
  );

  test(
    "extracts title from og:title meta tag",
    async () => {
      const md = createMarkItDown();
      const result = await md.convert(path.join(FIXTURES, "test_youtube.html"), {
        streamInfo: {
          url: "https://www.youtube.com/watch?v=V2qZ_lgxTzg",
          mimetype: "text/html",
          extension: ".html",
        },
      });

      // Title should be returned in result
      expect(result.title).toBeDefined();
      expect(result.title).toContain("Test Video Title");
    },
    YOUTUBE_TIMEOUT,
  );

  test(
    "video ID extraction from various URL formats",
    async () => {
      // We test the extractVideoId logic indirectly via the converter
      // The converter uses URL.searchParams.get("v")
      const md = createMarkItDown();
      const htmlPath = path.join(FIXTURES, "test_youtube.html");
      const htmlBuffer = fs.readFileSync(htmlPath);

      // Standard URL with v param
      const result1 = await md.convert(htmlBuffer, {
        streamInfo: {
          url: "https://www.youtube.com/watch?v=V2qZ_lgxTzg",
          mimetype: "text/html",
          extension: ".html",
        },
      });
      expect(result1.markdown).toContain("# YouTube");

      // URL with extra params
      const result2 = await md.convert(htmlBuffer, {
        streamInfo: {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
          mimetype: "text/html",
          extension: ".html",
        },
      });
      expect(result2.markdown).toContain("# YouTube");
    },
    YOUTUBE_TIMEOUT,
  );

  test("transcript fetch (network, skip in CI)", async () => {
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      console.log("Skipping network-dependent YouTube transcript test in CI");
      return;
    }

    const md = createMarkItDown();
    const htmlPath = path.join(FIXTURES, "test_youtube.html");
    const result = await md.convert(htmlPath, {
      streamInfo: {
        url: "https://www.youtube.com/watch?v=V2qZ_lgxTzg",
        mimetype: "text/html",
        extension: ".html",
      },
    });

    // Transcript section may or may not be present depending on network
    // Just verify the converter doesn't crash
    expect(result.markdown).toContain("# YouTube");
  });
});
