#!/usr/bin/env node
import fs from "node:fs";
import pkg from "../package.json";
import { FileConversionError, getSuggestion, UnsupportedFormatError } from "./exceptions.js";
import { EXIT_BAD_ARGUMENTS, EXIT_CODE_DESCRIPTIONS, EXIT_SUCCESS, getExitCode } from "./exit-codes.js";
import { createMarkItDown } from "./markitdown.js";

const VERSION = pkg.version;

const SUPPORTED_FORMATS = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "xls",
  "html",
  "csv",
  "epub",
  "zip",
  "msg",
  "json",
  "ipynb",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "tiff",
  "webp",
  "mp3",
  "wav",
];

const USAGE = `Usage: markitdown [options] [file...]

Convert documents to Markdown.

Arguments:
  file...              One or more file paths or glob patterns to convert

Options:
  -o, --output <file>  Write output to a file instead of stdout
  --json               Structured JSON output envelope
  -q, --quiet          Suppress non-essential output
  --describe           Print machine-readable tool description (JSON)
  -v, --version        Print version
  -h, --help           Print this help message

Environment variables:
  MARKITDOWN_OUTPUT_FORMAT=json   Equivalent to --json
  MARKITDOWN_QUIET=1              Equivalent to --quiet

Exit codes:
  0  success
  1  conversion failure
  2  bad arguments
  3  file not found
  4  permission denied
  5  unsupported format

Examples:
  markitdown document.pdf
  markitdown document.pdf -o output.md
  markitdown *.pdf --json
  markitdown file1.docx file2.xlsx
  cat document.pdf | markitdown
  cat document.pdf | markitdown --json`;

// --- Types ---

interface ConvertSuccess {
  status: "success";
  file: string;
  title?: string;
  markdown: string;
}

interface ConvertFailure {
  status: "error";
  file: string;
  exitCode: number;
  errorType: string;
  message: string;
  suggestion?: string;
}

// --- Arg parsing ---

interface ParsedArgs {
  inputFiles: string[];
  outputFile?: string;
  jsonMode: boolean;
  quiet: boolean;
  describe: boolean;
  showHelp: boolean;
  showVersion: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    inputFiles: [],
    jsonMode: process.env.MARKITDOWN_OUTPUT_FORMAT === "json",
    quiet: process.env.MARKITDOWN_QUIET === "1",
    describe: false,
    showHelp: false,
    showVersion: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      result.showHelp = true;
      return result;
    }
    if (arg === "-v" || arg === "--version") {
      result.showVersion = true;
      return result;
    }
    if (arg === "--describe") {
      result.describe = true;
      return result;
    }
    if (arg === "--json") {
      result.jsonMode = true;
      continue;
    }
    if (arg === "-q" || arg === "--quiet") {
      result.quiet = true;
      continue;
    }
    if (arg === "-o" || arg === "--output") {
      result.outputFile = argv[++i];
      if (!result.outputFile) {
        process.stderr.write("Error: --output requires a file path\n");
        process.exit(EXIT_BAD_ARGUMENTS);
      }
      continue;
    }
    if (arg.startsWith("-")) {
      process.stderr.write(`Error: Unknown option: ${arg}\n`);
      process.exit(EXIT_BAD_ARGUMENTS);
    }
    result.inputFiles.push(arg);
  }

  return result;
}

// --- Glob expansion ---

async function expandGlobs(patterns: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const pattern of patterns) {
    if (pattern.includes("*") || pattern.includes("?")) {
      const glob = new Bun.Glob(pattern);
      for await (const entry of glob.scan({ dot: false })) {
        files.push(entry);
      }
    } else {
      files.push(pattern);
    }
  }
  return files;
}

// --- Convert one file ---

async function convertOne(
  filePath: string,
  md: ReturnType<typeof createMarkItDown>,
): Promise<ConvertSuccess | ConvertFailure> {
  try {
    const result = await md.convert(filePath);
    return {
      status: "success",
      file: filePath,
      title: result.title || undefined,
      markdown: result.markdown,
    };
  } catch (e: any) {
    return {
      status: "error",
      file: filePath,
      exitCode: getExitCode(e),
      errorType: e.name || "Error",
      message: e.message || String(e),
      suggestion: getSuggestion(e),
    };
  }
}

async function convertStdin(md: ReturnType<typeof createMarkItDown>): Promise<ConvertSuccess | ConvertFailure> {
  const MAX_STDIN_BYTES = 500 * 1024 * 1024; // 500MB
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_STDIN_BYTES) {
      return {
        status: "error",
        file: "stdin",
        exitCode: EXIT_BAD_ARGUMENTS,
        errorType: "InputTooLarge",
        message: "stdin input exceeds 500MB limit",
      };
    }
    chunks.push(buf);
  }
  const buffer = Buffer.concat(chunks);

  if (buffer.length === 0) {
    return {
      status: "error",
      file: "stdin",
      exitCode: EXIT_BAD_ARGUMENTS,
      errorType: "EmptyInput",
      message: "No input received on stdin",
    };
  }

  try {
    let result: Awaited<ReturnType<typeof md.convert>> | undefined;
    try {
      result = await md.convert(buffer);
    } catch (e) {
      if (e instanceof UnsupportedFormatError || e instanceof FileConversionError) {
        result = await md.convert(buffer, {
          streamInfo: { charset: "utf-8" },
        });
      } else {
        throw e;
      }
    }
    return {
      status: "success",
      file: "stdin",
      title: result.title || undefined,
      markdown: result.markdown,
    };
  } catch (e: any) {
    return {
      status: "error",
      file: "stdin",
      exitCode: getExitCode(e),
      errorType: e.name || "Error",
      message: e.message || String(e),
      suggestion: getSuggestion(e),
    };
  }
}

// --- Output rendering ---

function outputResultsJson(successes: ConvertSuccess[], failures: ConvertFailure[], outputFile?: string) {
  const isBatch = successes.length + failures.length > 1;

  if (isBatch) {
    const status = failures.length === 0 ? "success" : successes.length === 0 ? "error" : "partial";
    const envelope = {
      version: 1,
      status,
      results: successes.map(({ status: _, ...rest }) => rest),
      errors: failures.map(({ status: _, ...rest }) => rest),
    };
    writeOutput(`${JSON.stringify(envelope, null, 2)}\n`, outputFile);
  } else if (successes.length === 1) {
    const s = successes[0];
    const envelope: Record<string, unknown> = {
      version: 1,
      status: "success",
      file: s.file,
      markdown: s.markdown,
    };
    if (s.title) envelope.title = s.title;
    writeOutput(`${JSON.stringify(envelope, null, 2)}\n`, outputFile);
  }

  // Write errors to stderr as JSON
  for (const f of failures) {
    const errEnvelope: Record<string, unknown> = {
      version: 1,
      status: "error",
      exitCode: f.exitCode,
      errorType: f.errorType,
      message: f.message,
      file: f.file,
    };
    if (f.suggestion) errEnvelope.suggestion = f.suggestion;
    process.stderr.write(`${JSON.stringify(errEnvelope, null, 2)}\n`);
  }
}

function outputResultsPlain(successes: ConvertSuccess[], failures: ConvertFailure[], outputFile?: string) {
  if (successes.length === 1 && failures.length === 0) {
    writeOutput(successes[0].markdown, outputFile);
  } else {
    // Batch plain mode: concatenate with file headers
    const parts: string[] = [];
    for (const s of successes) {
      parts.push(s.markdown);
    }
    if (parts.length > 0) {
      writeOutput(parts.join("\n---\n\n"), outputFile);
    }
    for (const f of failures) {
      process.stderr.write(`Error [${f.file}]: ${f.message}\n`);
    }
  }
}

function writeOutput(content: string, outputFile?: string) {
  if (outputFile) {
    fs.writeFileSync(outputFile, content, "utf-8");
  } else {
    process.stdout.write(content);
  }
}

// --- Describe ---

function printDescribe() {
  const description = {
    name: "markitdown",
    version: VERSION,
    description: "Convert documents to Markdown",
    supportedFormats: SUPPORTED_FORMATS,
    inputModes: ["file", "stdin", "url"],
    outputModes: ["markdown", "json"],
    flags: {
      "--json": "Structured JSON output envelope",
      "--quiet": "Suppress non-essential output",
      "--output <file>": "Write output to a file instead of stdout",
      "--describe": "Print machine-readable tool description",
      "--version": "Print version",
      "--help": "Print help message",
    },
    exitCodes: Object.fromEntries(Object.entries(EXIT_CODE_DESCRIPTIONS).map(([k, v]) => [k, v])),
    envVars: {
      MARKITDOWN_OUTPUT_FORMAT: "Set to 'json' for structured output",
      MARKITDOWN_QUIET: "Set to '1' to suppress non-essential output",
    },
  };
  process.stdout.write(`${JSON.stringify(description, null, 2)}\n`);
}

// --- Main ---

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.showHelp) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(EXIT_SUCCESS);
  }

  if (args.showVersion) {
    process.stdout.write(`${VERSION}\n`);
    process.exit(EXIT_SUCCESS);
  }

  if (args.describe) {
    printDescribe();
    process.exit(EXIT_SUCCESS);
  }

  const md = createMarkItDown();
  const successes: ConvertSuccess[] = [];
  const failures: ConvertFailure[] = [];

  if (args.inputFiles.length > 0) {
    const files = await expandGlobs(args.inputFiles);

    if (files.length === 0) {
      const msg = "Error: No files matched the given pattern(s)\n";
      if (args.jsonMode) {
        process.stderr.write(
          `${JSON.stringify(
            {
              version: 1,
              status: "error",
              exitCode: EXIT_BAD_ARGUMENTS,
              errorType: "NoFilesMatched",
              message: "No files matched the given pattern(s)",
            },
            null,
            2,
          )}\n`,
        );
      } else {
        process.stderr.write(msg);
      }
      process.exit(EXIT_BAD_ARGUMENTS);
    }

    for (const file of files) {
      const result = await convertOne(file, md);
      if (result.status === "success") {
        successes.push(result);
      } else {
        failures.push(result);
      }
    }
  } else if (!process.stdin.isTTY) {
    // Stdin pipe
    const result = await convertStdin(md);
    if (result.status === "success") {
      successes.push(result);
    } else {
      failures.push(result);
    }
  } else {
    // No input — print usage
    process.stderr.write(`${USAGE}\n`);
    process.exit(EXIT_BAD_ARGUMENTS);
  }

  // Output results
  if (args.jsonMode) {
    outputResultsJson(successes, failures, args.outputFile);
  } else {
    outputResultsPlain(successes, failures, args.outputFile);
  }

  // Determine exit code
  if (failures.length === 0) {
    process.exit(EXIT_SUCCESS);
  } else if (failures.length === 1 && successes.length === 0) {
    process.exit(failures[0].exitCode);
  } else {
    // Batch with at least one failure: use the first failure's exit code
    process.exit(failures[0].exitCode);
  }
}

main();
