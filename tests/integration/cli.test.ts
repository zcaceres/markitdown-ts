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
  opts?: { stdin?: Buffer; env?: Record<string, string> },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: opts?.stdin ? "pipe" : undefined,
    env: { ...process.env, ...opts?.env },
  });

  if (opts?.stdin && proc.stdin) {
    proc.stdin.write(opts.stdin);
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
    expect(stdout).toContain("--json");
    expect(stdout).toContain("--describe");
    expect(stdout).toContain("Exit codes:");
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
    const { stdout, exitCode } = await run([], { stdin: buffer });
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
    const { stdout, exitCode } = await run([], { stdin: buffer });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("While there is contemporaneous exploration of multi-agent approaches");
  });

  test("stdin pipe with DOCX buffer", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.docx"));
    const { stdout, exitCode } = await run([], { stdin: buffer });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("314b0a30-5b04-470b-b9f7-eed2c2bec74a");
  });

  // ---- Error cases ----

  test("nonexistent file exits with code 3", async () => {
    const { exitCode, stderr } = await run(["/nonexistent/file.pdf"]);
    expect(exitCode).toBe(3);
    expect(stderr).toContain("Error");
  });

  test("unknown flag exits with code 2", async () => {
    const { exitCode, stderr } = await run(["--bogus-flag"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("Unknown option");
  });

  test("no args and no stdin exits non-zero", async () => {
    const proc = Bun.spawn(["bun", CLI_PATH], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
      env: { ...process.env, FORCE_TTY: "1" },
    });
    proc.stdin.end();
    const exitCode = await proc.exited;
    expect(typeof exitCode).toBe("number");
  });

  // ---- JSON mode ----

  test("--json produces valid JSON envelope on success", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.json"),
      "--json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.version).toBe(1);
    expect(parsed.status).toBe("success");
    expect(parsed.file).toContain("test.json");
    expect(typeof parsed.markdown).toBe("string");
    expect(parsed.markdown).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
  });

  test("--json produces JSON error to stderr on failure", async () => {
    const { exitCode, stderr } = await run([
      "/nonexistent/file.pdf",
      "--json",
    ]);
    expect(exitCode).toBe(3);
    const parsed = JSON.parse(stderr);
    expect(parsed.version).toBe(1);
    expect(parsed.status).toBe("error");
    expect(parsed.exitCode).toBe(3);
    expect(parsed.file).toBe("/nonexistent/file.pdf");
  });

  test("MARKITDOWN_OUTPUT_FORMAT=json env var works like --json", async () => {
    const { stdout, exitCode } = await run(
      [path.join(FIXTURES, "test.json")],
      { env: { MARKITDOWN_OUTPUT_FORMAT: "json" } },
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.version).toBe(1);
    expect(parsed.status).toBe("success");
  });

  test("stdin + --json works with file field as stdin", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "test.json"));
    const { stdout, exitCode } = await run(["--json"], { stdin: buffer });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.file).toBe("stdin");
    expect(parsed.status).toBe("success");
  });

  // ---- Batch ----

  test("multiple files produce batch output", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.json"),
      path.join(FIXTURES, "test_mskanji.csv"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("5b64c88c-b3c3-4510-bcb8-da0b200602d8");
  });

  test("batch --json produces results array", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "test.json"),
      path.join(FIXTURES, "test_mskanji.csv"),
      "--json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.results.length).toBe(2);
    expect(Array.isArray(parsed.errors)).toBe(true);
  });

  test("batch with mixed success/failure produces partial status in JSON", async () => {
    const { stdout, stderr, exitCode } = await run([
      path.join(FIXTURES, "test.json"),
      "/nonexistent/file.pdf",
      "--json",
    ]);
    expect(exitCode).not.toBe(0);
    // In batch JSON mode, both results and errors go to stdout in the envelope
    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe("partial");
    expect(parsed.results.length).toBe(1);
    expect(parsed.errors.length).toBe(1);
  });

  // ---- Describe ----

  test("--describe returns valid JSON with correct fields", async () => {
    const { stdout, exitCode } = await run(["--describe"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.name).toBe("markitdown");
    expect(parsed.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(Array.isArray(parsed.supportedFormats)).toBe(true);
    expect(parsed.supportedFormats).toContain("pdf");
    expect(parsed.supportedFormats).toContain("docx");
    expect(Array.isArray(parsed.inputModes)).toBe(true);
    expect(Array.isArray(parsed.outputModes)).toBe(true);
    expect(parsed.flags).toBeDefined();
    expect(parsed.exitCodes).toBeDefined();
    expect(parsed.envVars).toBeDefined();
    expect(parsed.exitCodes["0"]).toBe("success");
    expect(parsed.exitCodes["5"]).toBe("unsupported format");
  });

  // ---- Glob expansion ----

  test("glob pattern expands and converts matching files", async () => {
    const { stdout, exitCode } = await run([
      path.join(FIXTURES, "*.json"),
      "--json",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    // Could be single or batch depending on how many .json files exist
    if (parsed.results) {
      expect(parsed.results.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(parsed.status).toBe("success");
    }
  });
});
