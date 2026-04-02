import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createMarkItDown } from "../../src/markitdown";

const FIXTURES = path.join(import.meta.dir, "../fixtures");

describe("CSV converter", () => {
  test("converts CSV with cp932 encoding", async () => {
    const md = createMarkItDown();
    const result = await md.convert(path.join(FIXTURES, "test_mskanji.csv"), { streamInfo: { charset: "cp932" } });

    expect(result.markdown).toContain("| 名前 | 年齢 | 住所 |");
    expect(result.markdown).toContain("| --- | --- | --- |");
    expect(result.markdown).toContain("| 佐藤太郎 | 30 | 東京 |");
    expect(result.markdown).toContain("| 三木英子 | 25 | 大阪 |");
    expect(result.markdown).toContain("| 髙橋淳 | 35 | 名古屋 |");
  });

  test("converts simple CSV from buffer", async () => {
    const csv = "Name,Age,City\nAlice,30,NYC\nBob,25,LA\n";
    const buffer = Buffer.from(csv);
    const md = createMarkItDown();
    const result = await md.convert(buffer, {
      streamInfo: { extension: ".csv", mimetype: "text/csv" },
    });

    expect(result.markdown).toContain("| Name | Age | City |");
    expect(result.markdown).toContain("| --- | --- | --- |");
    expect(result.markdown).toContain("| Alice | 30 | NYC |");
    expect(result.markdown).toContain("| Bob | 25 | LA |");
  });

  test("handles empty CSV", async () => {
    const buffer = Buffer.from("");
    const md = createMarkItDown();
    const result = await md.convert(buffer, {
      streamInfo: { extension: ".csv", mimetype: "text/csv" },
    });
    expect(result.markdown).toBe("");
  });

  test("pads short rows", async () => {
    const csv = "A,B,C\n1\n";
    const buffer = Buffer.from(csv);
    const md = createMarkItDown();
    const result = await md.convert(buffer, {
      streamInfo: { extension: ".csv" },
    });
    expect(result.markdown).toContain("| 1 |  |  |");
  });
});
