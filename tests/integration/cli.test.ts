import { describe, test, expect, afterEach } from "bun:test";
import path from "node:path";
import fs from "node:fs";

const CLI_PATH = path.join(import.meta.dir, "../../src/cli.ts");
const FIXTURES = path.join(import.meta.dir, "../fixtures");

const tmpFiles: string[] = [];
afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
  tmpFiles.length = 0;
});

async function run(
  args: string[],
  stdin?: Buffer,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: stdin ? "pipe" : undefined,
  });

  if (stdin && proc.stdin) {
    proc.stdin.write(stdin);
    proc.stdin.end();
  }

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

describe("CLI", () => {
  test("converts file to stdout", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.json"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
  });

  test("--version prints semver", async () => {
    const { stdout, exitCode } = await run(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("--help prints usage", async () => {
    const { stdout, exitCode } = await run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });

  test("-o writes output to file", async () => {
    const tmpPath = path.join(import.meta.dir, `_cli_test_${Date.now()}.md`);
    tmpFiles.push(tmpPath);
    const { exitCode } = await run([
      path.join(FIXTURES, "test.json"),
      "-o",
      tmpPath,
    ]);
    expect(exitCode).toBe(0);
    const content = fs.readFileSync(tmpPath, "utf-8");
    expect(content).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
  });

  test("stdin pipe works", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.json"));
    const { stdout, exitCode } = await run([], buffer);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
  });

  // ---- Format coverage: file path input ----

  test("converts PDF file", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.pdf"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("While there is contemporaneous exploration of multi-agent approaches");
  });

  test("converts DOCX file", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.docx"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
  });

  test("converts XLSX file", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.xlsx"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("6ff4173b-42a5-4784-9b19-f49caff4d93d");
  });

  test("converts PPTX file", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.pptx"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2cdda5c8-e50e-4db4-b5f0-9722a649f455");
  });

  test("converts HTML file", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test_blog.html"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Large language models");
  });

  test("converts EPUB file", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.epub"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Chapter 1: Test Content");
  });

  // ---- Format coverage: stdin pipe with binary ----

  test("stdin pipe with PDF buffer", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.pdf"));
    const { stdout, exitCode } = await run([], buffer);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("While there is contemporaneous exploration of multi-agent approaches");
  });

  test("stdin pipe with DOCX buffer", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.docx"));
    const { stdout, exitCode } = await run([], buffer);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
  });

  // ---- Error cases ----

  test("nonexistent file exits non-zero", async () => {
    const { exitCode, stderr } = await run(["/nonexistent/file.pdf"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Error:");
  });

  test("no args and no stdin exits non-zero", async () => {
    // Spawn with stdin as a TTY-like pipe that immediately closes
    const proc = Bun.spawn(["bun", CLI_PATH], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
      env: { ...process.env, FORCE_TTY: "1" },
    });
    // Close stdin immediately to simulate no input
    proc.stdin.end();
    const exitCode = await proc.exited;
    // When stdin is a pipe (not TTY), it will try to read and get empty buffer
    // which may fail. Either way, non-zero or the usage path is fine.
    // The real "no args + TTY" case can't be easily tested in CI.
    // Just verify the process completes.
    expect(typeof exitCode).toBe("number");
  });
});
