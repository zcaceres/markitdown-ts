import type { ConvertOptions, ConvertResult, StreamInfo } from "./types.js";

export type ConverterContext = {
  buffer: Buffer;
  info: StreamInfo;
  opts: ConvertOptions;
};

export type Matcher = (ctx: ConverterContext) => boolean;
export type TransformStep = (ctx: ConverterContext) => Promise<ConvertResult>;

export type Converter = {
  name: string;
  match: Matcher;
  convert: TransformStep;
};

// --- Matcher combinators ---

export function byMime(...mimes: string[]): Matcher {
  return (ctx) => {
    const mimetype = (ctx.info.mimetype ?? "").toLowerCase();
    if (!mimetype) return false;
    return mimes.some((m) => {
      if (m.endsWith("/*")) {
        return mimetype.startsWith(m.slice(0, -1));
      }
      return mimetype.startsWith(m);
    });
  };
}

export function byExt(...exts: string[]): Matcher {
  return (ctx) => {
    const ext = (ctx.info.extension ?? "").toLowerCase();
    if (!ext) return false;
    return exts.some((e) => ext === e.toLowerCase());
  };
}

export function byUrl(pattern: RegExp): Matcher {
  return (ctx) => {
    const url = ctx.info.url ?? "";
    if (!url) return false;
    return pattern.test(url);
  };
}

export function anyOf(...matchers: Matcher[]): Matcher {
  return (ctx) => matchers.some((m) => m(ctx));
}

export function allOf(...matchers: Matcher[]): Matcher {
  return (ctx) => matchers.every((m) => m(ctx));
}

export function hasCharset(): Matcher {
  return (ctx) => ctx.info.charset != null;
}

/**
 * Create a converter from a name, matcher, and a conversion function.
 */
export function converter(name: string, match: Matcher, convert: TransformStep): Converter {
  return { name, match, convert };
}
