import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parseVersion(version: string): number[] {
  return version.split(".").map((s) => parseInt(s, 10));
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export async function exiftoolMetadata(
  buffer: Buffer,
  exiftoolPath?: string,
): Promise<Record<string, string>> {
  if (!exiftoolPath) return {};

  // Verify version (CVE-2021-22204 mitigation)
  try {
    const { stdout } = await execFileAsync(exiftoolPath, ["-ver"]);
    const version = parseVersion(stdout.trim());
    if (compareVersions(version, [12, 24]) < 0) {
      throw new Error(
        `ExifTool version ${stdout.trim()} is vulnerable to CVE-2021-22204. Please upgrade to version 12.24 or later.`,
      );
    }
  } catch (e: any) {
    if (e.message?.includes("CVE")) throw e;
    throw new Error("Failed to verify ExifTool version.");
  }

  // Run exiftool with buffer piped to stdin
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn(exiftoolPath!, ["-json", "-"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.on("close", (code) => {
        resolve(Buffer.concat(chunks).toString("utf-8"));
      });
      proc.on("error", reject);
      proc.stdin.write(buffer);
      proc.stdin.end();
    });
    const parsed = JSON.parse(result);
    return parsed[0] ?? {};
  } catch {
    return {};
  }
}
