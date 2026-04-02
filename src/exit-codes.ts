import { FileConversionError, UnsupportedFormatError } from "./exceptions.js";

export const EXIT_SUCCESS = 0;
export const EXIT_CONVERSION_FAILURE = 1;
export const EXIT_BAD_ARGUMENTS = 2;
export const EXIT_FILE_NOT_FOUND = 3;
export const EXIT_PERMISSION_DENIED = 4;
export const EXIT_UNSUPPORTED_FORMAT = 5;

export const EXIT_CODE_DESCRIPTIONS: Record<number, string> = {
  [EXIT_SUCCESS]: "success",
  [EXIT_CONVERSION_FAILURE]: "conversion failure",
  [EXIT_BAD_ARGUMENTS]: "bad arguments",
  [EXIT_FILE_NOT_FOUND]: "file not found",
  [EXIT_PERMISSION_DENIED]: "permission denied",
  [EXIT_UNSUPPORTED_FORMAT]: "unsupported format",
};

export function getExitCode(error: unknown): number {
  if (error instanceof UnsupportedFormatError) return EXIT_UNSUPPORTED_FORMAT;
  if (error instanceof FileConversionError) return EXIT_CONVERSION_FAILURE;

  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "ENOENT") return EXIT_FILE_NOT_FOUND;
    if (code === "EACCES" || code === "EPERM") return EXIT_PERMISSION_DENIED;
  }

  return EXIT_CONVERSION_FAILURE;
}
