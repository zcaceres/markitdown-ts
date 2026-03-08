import iconv from "iconv-lite";

/**
 * Decode a buffer to string using the given charset.
 * Falls back to utf-8 if no charset is specified.
 * Uses iconv-lite for non-standard encodings.
 */
export function decodeBuffer(buffer: Buffer, charset?: string): string {
  const encoding = charset ?? "utf-8";

  // Try native TextDecoder first (handles utf-8, utf-16, latin1, etc.)
  try {
    const decoder = new TextDecoder(encoding, { fatal: true });
    return decoder.decode(buffer);
  } catch {
    // Fall back to iconv-lite for exotic encodings (cp932, shift_jis, etc.)
  }

  if (iconv.encodingExists(encoding)) {
    return iconv.decode(buffer, encoding);
  }

  // Last resort: utf-8 lossy
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}
