import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("Wikipedia converter", () => {
  test("converts Wikipedia HTML", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_wikipedia.html"), {
      streamInfo: {
        charset: "utf-8",
        url: "https://en.wikipedia.org/wiki/Microsoft",
      },
    });

    expect(result.markdown).toContain(
      "Microsoft entered the operating system (OS) business in 1980 with its own version of [Unix]",
    );
    expect(result.markdown).toContain('Microsoft was founded by [Bill Gates](/wiki/Bill_Gates "Bill Gates")');

    // Must not include navigation elements
    expect(result.markdown).not.toContain("You are encouraged to create an account and log in");
    expect(result.markdown).not.toContain("154 languages");
    expect(result.markdown).not.toContain("move to sidebar");
  });
});
