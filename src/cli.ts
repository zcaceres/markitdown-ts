#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createMarkItDown } from "./markitdown.js";

const VERSION = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
).version;

const USAGE = `Usage: markitdown [options] [file]

Convert documents to Markdown.

Arguments:
  file              Path to the file to convert (or pipe via stdin)

Options:
  -o, --output <file>  Write output to a file instead of stdout
  -v, --version        Print version
  -h, --help           Print this help message

Examples:
  markitdown document.pdf
  markitdown document.pdf -o output.md
  cat document.pdf | markitdown`;

async function main() {
  const args = process.argv.slice(2);

  let inputFile: string | undefined;
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(USAGE + "\n");
      process.exit(0);
    }
    if (arg === "-v" || arg === "--version") {
      process.stdout.write(VERSION + "\n");
      process.exit(0);
    }
    if (arg === "-o" || arg === "--output") {
      outputFile = args[++i];
      if (!outputFile) {
        process.stderr.write("Error: --output requires a file path\n");
        process.exit(1);
      }
      continue;
    }
    if (arg.startsWith("-")) {
      process.stderr.write(`Error: Unknown option: ${arg}\n`);
      process.exit(1);
    }
    if (!inputFile) {
      inputFile = arg;
    } else {
      process.stderr.write(`Error: Unexpected argument: ${arg}\n`);
      process.exit(1);
    }
  }

  let buffer: Buffer | undefined;
  let streamInfo: Record<string, string | undefined> | undefined;

  if (inputFile) {
    // File path provided
    const md = createMarkItDown();
    try {
      const result = await md.convert(inputFile);
      writeOutput(result.markdown, outputFile);
    } catch (e: any) {
      process.stderr.write(`Error: ${e.message}\n`);
      process.exit(1);
    }
    return;
  }

  // Check for stdin pipe
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);

    const md = createMarkItDown();
    try {
      // Try with auto-detection first; if that fails and it looks like text, retry with charset hint
      let result;
      try {
        result = await md.convert(buffer);
      } catch {
        result = await md.convert(buffer, {
          streamInfo: { charset: "utf-8" },
        });
      }
      writeOutput(result.markdown, outputFile);
    } catch (e: any) {
      process.stderr.write(`Error: ${e.message}\n`);
      process.exit(1);
    }
    return;
  }

  // No input — print usage
  process.stderr.write(USAGE + "\n");
  process.exit(1);
}

function writeOutput(markdown: string, outputFile?: string) {
  if (outputFile) {
    fs.writeFileSync(outputFile, markdown, "utf-8");
  } else {
    process.stdout.write(markdown);
  }
}

main();
