import path from "node:path";
import { fileURLToPath } from "node:url";

export function fileUriToPath(fileUri: string): { netloc: string | null; path: string } {
  if (!fileUri.startsWith("file:")) {
    throw new Error(`Not a file URL: ${fileUri}`);
  }

  // Extract netloc manually since URL normalizes file://localhost to file:///
  let netloc: string | null = null;
  const afterScheme = fileUri.slice(5); // strip "file:"
  if (afterScheme.startsWith("//")) {
    const rest = afterScheme.slice(2);
    const slashIdx = rest.indexOf("/");
    if (slashIdx > 0) {
      const host = rest.slice(0, slashIdx);
      if (host && host !== "") {
        netloc = host;
      }
    }
  }

  const localPath = path.resolve(fileURLToPath(fileUri));
  return { netloc, path: localPath };
}

export function parseDataUri(uri: string): {
  mimeType: string | null;
  attributes: Record<string, string>;
  data: Buffer;
} {
  if (!uri.startsWith("data:")) {
    throw new Error("Not a data URI");
  }

  const commaIndex = uri.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Malformed data URI, missing ',' separator");
  }

  const meta = uri.slice(5, commaIndex); // Strip 'data:'
  const rawData = uri.slice(commaIndex + 1);
  const parts = meta.split(";");

  let isBase64 = false;
  if (parts[parts.length - 1] === "base64") {
    parts.pop();
    isBase64 = true;
  }

  let mimeType: string | null = null;
  if (parts.length > 0 && parts[0].length > 0) {
    mimeType = parts.shift()!;
  }

  const attributes: Record<string, string> = {};
  for (const part of parts) {
    if (part.includes("=")) {
      const [key, ...rest] = part.split("=");
      attributes[key] = rest.join("=");
    } else if (part.length > 0) {
      attributes[part] = "";
    }
  }

  const data = isBase64
    ? Buffer.from(rawData, "base64")
    : Buffer.from(decodeURIComponent(rawData));

  return { mimeType, attributes, data };
}
