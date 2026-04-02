import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("Outlook MSG converter", () => {
  test("converts Outlook MSG email", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_outlook_msg.msg"));

    expect(result.markdown).toContain("# Email Message");
    expect(result.markdown).toContain("**From:** test.sender@example.com");
    expect(result.markdown).toContain("**To:** test.recipient@example.com");
    expect(result.markdown).toContain("**Subject:** Test Email Message");
    expect(result.markdown).toContain("## Content");
    expect(result.markdown).toContain("This is the body of the test email message");
  });

  test("extracts subject as title", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_outlook_msg.msg"));
    expect(result.title).toBe("Test Email Message");
  });
});
