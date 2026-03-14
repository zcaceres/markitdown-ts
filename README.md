# markitdown-ts

A TypeScript port of Microsoft's [markitdown](https://github.com/microsoft/markitdown) Python library. Converts documents to Markdown.

## Supported Formats

| Format | Extensions | Notes |
|--------|-----------|-------|
| Plain text | `.txt`, `.text`, `.md`, `.markdown`, `.json`, `.jsonl`, `.xml`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.conf`, `.log`, `.env` | Charset detection via iconv-lite |
| CSV | `.csv` | Converts to Markdown tables |
| HTML | `.html`, `.htm` | Cheerio + Turndown with GFM tables |
| DOCX | `.docx` | Via mammoth |
| XLSX / XLS | `.xlsx`, `.xls` | Via SheetJS |
| PDF | `.pdf` | Dual-engine: pdfplumber-wasm for tables/forms, pdf-parse fallback |
| PPTX | `.pptx` | Extracts text, tables, charts, image alt text, notes |
| Jupyter Notebooks | `.ipynb` | Code cells, markdown cells, outputs |
| EPUB | `.epub` | Metadata + chapter content |
| ZIP | `.zip` | Recursively converts contained files |
| RSS / Atom | `.xml`, `.rss`, `.atom` | Feed metadata and article content |
| Outlook MSG | `.msg` | Email headers and body |
| Images | `.jpg`, `.jpeg`, `.png` | Metadata via exiftool (optional), LLM descriptions (optional) |
| Audio | `.wav`, `.mp3`, `.m4a`, `.mp4` | Metadata via exiftool (optional) |
| Wikipedia | `wikipedia.org` URLs | Extracts article content, removes navigation |
| YouTube | `youtube.com/watch` URLs | Video metadata + transcript fetching |
| Bing SERP | `bing.com/search` URLs | Search result extraction |

## Installation

```bash
bun add markitdown-typescript
```

## Usage

```typescript
import { createMarkItDown } from "markitdown-typescript";

const md = createMarkItDown();

// Convert a local file
const result = await md.convert("document.docx");
console.log(result.markdown);
console.log(result.title);

// Convert a buffer
const buffer = await fs.promises.readFile("spreadsheet.xlsx");
const result = await md.convert(buffer, {
  streamInfo: { mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
});

// Convert a URL
const result = await md.convert("https://en.wikipedia.org/wiki/TypeScript");

// Convert a data URI
const result = await md.convert("data:text/plain;base64,SGVsbG8gV29ybGQ=");
```

### Options

```typescript
const md = createMarkItDown({
  // Keep data URIs in images instead of truncating
  keepDataUris: true,

  // Exiftool path for image/audio metadata extraction
  exiftoolPath: "/usr/local/bin/exiftool",

  // LLM client for image descriptions (OpenAI-compatible API)
  llmClient: openaiClient,
  llmModel: "gpt-4o",
  llmPrompt: "Describe this image in detail.",

  // Custom mammoth style mapping for DOCX conversion
  styleMap: "p[style-name='Quote'] => blockquote:fresh",

  // Preferred languages for YouTube transcript fetching
  youtubeTranscriptLanguages: ["en", "es"],
});
```

### Custom Converters

```typescript
import { createMarkItDown, converter, byExt } from "markitdown-typescript";

const myConverter = converter(
  "MyFormat",
  byExt(".myext"),
  async (ctx) => {
    const text = new TextDecoder().decode(ctx.buffer);
    return { markdown: `# Custom\n\n${text}` };
  },
);

const md = createMarkItDown();
md.registerConverter(myConverter);
```

## CLI

```bash
# Convert a file to Markdown
markitdown document.pdf

# Write output to a file
markitdown document.pdf -o output.md

# Structured JSON output
markitdown document.pdf --json

# Batch conversion
markitdown file1.docx file2.xlsx

# Pipe from stdin
cat document.pdf | markitdown
```

Exit codes: `0` success, `1` conversion failure, `2` bad arguments, `3` file not found, `4` permission denied, `5` unsupported format.

Set `MARKITDOWN_OUTPUT_FORMAT=json` or `MARKITDOWN_QUIET=1` as environment variable alternatives to `--json` and `--quiet`.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build

# Compile standalone binary
bun run compile
```

## Architecture

The library uses a composable functional pipeline instead of class-based converters:

- **Matchers** decide if a converter handles the input: `byMime()`, `byExt()`, `byUrl()`, `anyOf()`, `allOf()`, `hasCharset()`
- **Transform steps** process data: `async (ctx) => Promise<ConvertResult>`
- **`converter()`** combines a name, matcher, and transform into a `Converter`

Converters are registered with priorities. Specific format converters (DOCX, PDF, etc.) are tried first, generic ones (plain text, HTML) are tried last.

## License

Apache 2.0 — see [LICENSE](./LICENSE).

## Acknowledgments

This is a TypeScript port of [Microsoft's markitdown](https://github.com/microsoft/markitdown) Python library. Test fixtures are from the original project.
