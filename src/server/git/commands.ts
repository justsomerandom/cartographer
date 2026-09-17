import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: unknown;
  notInstalled: boolean;
}

export async function runGit(args: string[], cwd: string): Promise<GitCommandResult> {
  try {
    const result = await execFileAsync("git", args, {
      cwd,
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      ok: true,
      stdout: result.stdout,
      stderr: result.stderr,
      notInstalled: false,
    };
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      ok: false,
      stdout: nodeError.stdout ?? "",
      stderr: nodeError.stderr ?? "",
      error,
      notInstalled: nodeError.code === "ENOENT",
    };
  }
}
