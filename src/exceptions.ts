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
