export class MarkItDownError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MarkItDownError";
  }
}

export class MissingDependencyError extends MarkItDownError {
  constructor(message?: string) {
    super(message);
    this.name = "MissingDependencyError";
  }
}

export class UnsupportedFormatError extends MarkItDownError {
  constructor(message?: string) {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

export interface FailedConversionAttempt {
  converterName: string;
  error?: Error;
}

const SUPPORTED_FORMATS_LIST =
  "pdf, docx, pptx, xlsx, xls, html, csv, epub, zip, msg, json, ipynb, jpg, png, mp3, wav";

export function getSuggestion(error: unknown): string | undefined {
  if (error instanceof UnsupportedFormatError) {
    return `Supported formats: ${SUPPORTED_FORMATS_LIST}. Use --describe for full details.`;
  }
  if (error instanceof FileConversionError) {
    return "The file was recognized but conversion failed. Ensure the file is not corrupted.";
  }
  if (error instanceof MissingDependencyError) {
    return "A required dependency is missing. Check the installation.";
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "ENOENT") return "Check the file path and try again.";
    if (code === "EACCES" || code === "EPERM")
      return "Check file permissions and try again.";
  }
  return undefined;
}

export class FileConversionError extends MarkItDownError {
  attempts?: FailedConversionAttempt[];

  constructor(
    message?: string,
    attempts?: FailedConversionAttempt[],
  ) {
    if (!message && attempts) {
      message = `File conversion failed after ${attempts.length} attempts:\n`;
      for (const attempt of attempts) {
        if (attempt.error) {
          message += ` - ${attempt.converterName} threw ${attempt.error.name}: ${attempt.error.message}\n`;
        } else {
          message += ` - ${attempt.converterName} provided no error info.\n`;
        }
      }
    }
    super(message ?? "File conversion failed.");
    this.name = "FileConversionError";
    this.attempts = attempts;
  }
}
