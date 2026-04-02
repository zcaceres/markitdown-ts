import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("Ipynb converter", () => {
  test("converts Jupyter notebook", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_notebook.ipynb"));

    expect(result.markdown).toContain("# Test Notebook");
    expect(result.markdown).toContain("```python");
    expect(result.markdown).toContain('print("markitdown")');
    expect(result.markdown).toContain("```");
    expect(result.markdown).toContain("## Code Cell Below");

    // Must not include notebook metadata
    expect(result.markdown).not.toContain("nbformat");
    expect(result.markdown).not.toContain("nbformat_minor");
  });

  test("extracts title from first heading", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_notebook.ipynb"));
    expect(result.title).toBe("Test Notebook Title");
  });

  test("handles notebook from buffer with mimetype hint", async () => {
    const notebook = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: "markdown",
          source: ["# Hello\n", "World"],
          metadata: {},
        },
        {
          cell_type: "code",
          source: ['x = 1\nprint("hi")'],
          metadata: {},
          outputs: [],
        },
      ],
    });

    const md = createMarkItDown();
    const result = await md.convert(Buffer.from(notebook), {
      streamInfo: { mimetype: "application/json" },
    });

    expect(result.markdown).toContain("# Hello");
    expect(result.markdown).toContain("```python");
    expect(result.markdown).toContain('print("hi")');
    expect(result.title).toBe("Hello");
  });
});
