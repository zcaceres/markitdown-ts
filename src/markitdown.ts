import fs from "node:fs";
import path from "node:path";
import type { Converter, ConverterContext } from "./converter.js";
import { audioConverter } from "./converters/audio.js";
import { bingSerpConverter } from "./converters/bing-serp.js";
import { csvConverter } from "./converters/csv.js";
import { docxConverter } from "./converters/docx.js";
import { epubConverter } from "./converters/epub.js";
import { htmlConverter } from "./converters/html.js";
import { imageConverter } from "./converters/image.js";
import { ipynbConverter } from "./converters/ipynb.js";
import { outlookMsgConverter } from "./converters/outlook-msg.js";
import { pdfConverter } from "./converters/pdf.js";
import { plainTextConverter } from "./converters/plain-text.js";
import { pptxConverter } from "./converters/pptx.js";
import { rssConverter } from "./converters/rss.js";
import { wikipediaConverter } from "./converters/wikipedia.js";
import { xlsConverter, xlsxConverter } from "./converters/xlsx.js";
import { youtubeConverter } from "./converters/youtube.js";
import { createZipConverter } from "./converters/zip.js";
import { type FailedConversionAttempt, FileConversionError, UnsupportedFormatError } from "./exceptions.js";
import { guessExtensionFromMime, guessMimeFromExtension, mergeStreamInfo } from "./stream-info.js";
import type { ConvertOptions, ConvertResult, StreamInfo } from "./types.js";
import { fileUriToPath, parseDataUri } from "./uri-utils.js";

const PRIORITY_SPECIFIC = 0;
const PRIORITY_GENERIC = 10;

interface ConverterRegistration {
  converter: Converter;
  priority: number;
}

export interface MarkItDownOptions extends ConvertOptions {}

export interface ConvertInput {
  streamInfo?: StreamInfo;
}

export function createMarkItDown(options?: MarkItDownOptions) {
  const opts: ConvertOptions = options ?? {};
  const registrations: ConverterRegistration[] = [];

  // Register built-in converters (specific first, generic last)
  // Later registrations with same priority are tried first (inserted at front)
  function register(conv: Converter, priority = PRIORITY_SPECIFIC) {
    registrations.unshift({ converter: conv, priority });
  }

  // Generic converters (priority 10, tried last)
  register(plainTextConverter, PRIORITY_GENERIC);
  register(htmlConverter, PRIORITY_GENERIC);

  // Specific converters (priority 0, tried first)
  register(csvConverter);
  register(ipynbConverter);
  register(docxConverter);
  register(xlsxConverter);
  register(xlsConverter);
  register(pdfConverter);
  register(pptxConverter);
  register(rssConverter);
  register(wikipediaConverter);
  register(youtubeConverter);
  register(bingSerpConverter);
  register(epubConverter);
  register(imageConverter);
  register(audioConverter);
  register(outlookMsgConverter);
  register(createZipConverter(convert));

  function getSorted(): ConverterRegistration[] {
    return [...registrations].sort((a, b) => a.priority - b.priority);
  }

  async function detectStreamInfo(buffer: Buffer, base: StreamInfo): Promise<StreamInfo[]> {
    const guesses: StreamInfo[] = [];

    let enhanced = { ...base };

    // If extension but no mime, guess it
    if (!enhanced.mimetype && enhanced.extension) {
      const guessedMime = guessMimeFromExtension(enhanced.extension);
      if (guessedMime) enhanced = { ...enhanced, mimetype: guessedMime };
    }

    // If mime but no extension, guess it
    if (enhanced.mimetype && !enhanced.extension) {
      const guessedExt = guessExtensionFromMime(enhanced.mimetype);
      if (guessedExt) enhanced = { ...enhanced, extension: guessedExt };
    }

    // Try file-type detection from buffer content
    try {
      const { fileTypeFromBuffer } = await import("file-type");
      const detected = await fileTypeFromBuffer(buffer);
      if (detected) {
        const detectedExt = `.${detected.ext}`;
        const isCompatible =
          (!base.mimetype || base.mimetype === detected.mime) && (!base.extension || base.extension === detectedExt);

        if (isCompatible) {
          guesses.push({
            ...enhanced,
            mimetype: enhanced.mimetype ?? detected.mime,
            extension: enhanced.extension ?? detectedExt,
          });
        } else {
          // Incompatible: add both guesses
          guesses.push(enhanced);
          guesses.push({
            ...base,
            mimetype: detected.mime,
            extension: detectedExt,
          });
        }
      } else {
        guesses.push(enhanced);
      }
    } catch {
      guesses.push(enhanced);
    }

    return guesses;
  }

  function normalizeResult(result: ConvertResult): ConvertResult {
    let md = result.markdown;
    // Strip trailing whitespace from each line
    md = md
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .join("\n");
    // Collapse 3+ consecutive newlines to 2
    md = md.replace(/\n{3,}/g, "\n\n");
    return { ...result, markdown: md };
  }

  async function runConversion(buffer: Buffer, streamInfoGuesses: StreamInfo[]): Promise<ConvertResult> {
    const sorted = getSorted();
    const failedAttempts: FailedConversionAttempt[] = [];

    // Try each guess, plus a bare StreamInfo as fallback
    const allGuesses = [...streamInfoGuesses, {} as StreamInfo];

    for (const info of allGuesses) {
      for (const reg of sorted) {
        const ctx: ConverterContext = { buffer, info, opts };

        let accepts = false;
        try {
          accepts = reg.converter.match(ctx);
        } catch {
          // match threw — skip
        }

        if (accepts) {
          try {
            const result = await reg.converter.convert(ctx);
            return normalizeResult(result);
          } catch (e) {
            failedAttempts.push({
              converterName: reg.converter.name,
              error: e instanceof Error ? e : new Error(String(e)),
            });
          }
        }
      }
    }

    if (failedAttempts.length > 0) {
      throw new FileConversionError(undefined, failedAttempts);
    }

    throw new UnsupportedFormatError(
      "Could not convert to Markdown. No converter attempted a conversion, suggesting the format is not supported.",
    );
  }

  // --- Public API ---

  async function convert(
    source: string | Buffer,
    input?: ConvertInput & { _zipDepth?: number },
  ): Promise<ConvertResult> {
    // Thread _zipDepth from caller (e.g. zip converter) into opts
    const prevDepth = opts._zipDepth;
    if (input?._zipDepth !== undefined) {
      opts._zipDepth = input._zipDepth;
    }
    try {
      if (typeof source === "string") {
        if (
          source.startsWith("http:") ||
          source.startsWith("https:") ||
          source.startsWith("file:") ||
          source.startsWith("data:")
        ) {
          return await convertUri(source, input?.streamInfo);
        }
        return await convertLocal(source, input?.streamInfo);
      }

      // Buffer
      const info = input?.streamInfo ?? {};
      const guesses = await detectStreamInfo(source, info);
      return await runConversion(source, guesses);
    } finally {
      opts._zipDepth = prevDepth;
    }
  }

  async function convertLocal(filePath: string, streamInfo?: StreamInfo): Promise<ConvertResult> {
    const ext = path.extname(filePath);
    const filename = path.basename(filePath);

    const base: StreamInfo = {
      localPath: filePath,
      extension: ext || undefined,
      filename,
    };

    const merged = streamInfo ? mergeStreamInfo(base, streamInfo) : base;
    const buffer = await fs.promises.readFile(filePath);
    const guesses = await detectStreamInfo(buffer, merged);
    return runConversion(buffer, guesses);
  }

  async function convertUri(uri: string, streamInfo?: StreamInfo): Promise<ConvertResult> {
    uri = uri.trim();

    if (uri.startsWith("file:")) {
      const { netloc, path: localPath } = fileUriToPath(uri);
      if (netloc && netloc !== "localhost") {
        throw new Error(`Unsupported file URI: ${uri}. Netloc must be empty or localhost.`);
      }
      return convertLocal(localPath, streamInfo);
    }

    if (uri.startsWith("data:")) {
      const { mimeType, attributes, data } = parseDataUri(uri);
      const base: StreamInfo = {
        mimetype: mimeType ?? undefined,
        charset: attributes.charset,
      };
      const merged = streamInfo ? mergeStreamInfo(base, streamInfo) : base;
      const guesses = await detectStreamInfo(data, merged);
      return runConversion(data, guesses);
    }

    if (uri.startsWith("http:") || uri.startsWith("https:")) {
      return convertUrl(uri, streamInfo);
    }

    throw new Error(`Unsupported URI scheme: ${uri.split(":")[0]}. Supported: file, data, http, https`);
  }

  async function convertUrl(url: string, streamInfo?: StreamInfo): Promise<ConvertResult> {
    const response = await fetch(url, {
      headers: {
        Accept: "text/markdown, text/html;q=0.9, text/plain;q=0.8, */*;q=0.1",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse content-type
    let mimetype: string | undefined;
    let charset: string | undefined;
    const contentType = response.headers.get("content-type");
    if (contentType) {
      const parts = contentType.split(";");
      mimetype = parts.shift()?.trim();
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.startsWith("charset=")) {
          const val = trimmed.slice(8).trim();
          if (val) charset = val;
        }
      }
    }

    // Parse content-disposition for filename
    let filename: string | undefined;
    let extension: string | undefined;
    const disposition = response.headers.get("content-disposition");
    if (disposition) {
      const match = disposition.match(/filename=([^;]+)/);
      if (match) {
        filename = match[1].replace(/["']/g, "");
        const ext = path.extname(filename);
        if (ext) extension = ext;
      }
    }

    // Try to get filename from URL path
    if (!filename) {
      try {
        const parsed = new URL(url);
        const ext = path.extname(parsed.pathname);
        if (ext) {
          filename = path.basename(parsed.pathname);
          extension = ext;
        }
      } catch {
        // ignore
      }
    }

    const base: StreamInfo = {
      mimetype,
      charset,
      filename,
      extension,
      url,
    };

    const merged = streamInfo ? mergeStreamInfo(base, streamInfo) : base;
    const buffer = Buffer.from(await response.arrayBuffer());
    const guesses = await detectStreamInfo(buffer, merged);
    return runConversion(buffer, guesses);
  }

  return {
    convert,
    convertLocal,
    convertUri,
    convertUrl,
    registerConverter: (conv: Converter, priority = PRIORITY_SPECIFIC) => {
      register(conv, priority);
    },
  };
}
