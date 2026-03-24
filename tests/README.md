# Testing & Parity Comparison

This folder contains everything needed to systematically compare `markitdown-ts` with the original Microsoft Python `markitdown`.

## Directory Structure

```bash
tests/
├── fixtures/                  # Sample test files, organized by format
│   ├── pdf/
│   ├── docx/
│   ├── pptx/
│   ├── xlsx/
│   ├── images/
│   ├── audio/
│   ├── youtube/               # JSON or txt file with URLs
│   ├── html/
│   ├── epub/
│   ├── zip/
│   └── misc/                  # CSV, JSON, XML, etc.
├── expected/                  # Golden Markdown outputs from official Python markitdown
├── results/                   # Gitignored – outputs from TS version for comparison
├── comparison/
│   ├── run-comparison.ts      # Main automated comparison script
│   ├── generate-report.ts
│   └── parity-checklist.md    # Detailed tracking (can be symlink or copy)
├── integration/               # Vitest / Bun test cases
└── README.md