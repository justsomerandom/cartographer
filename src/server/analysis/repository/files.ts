import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  FileInfo,
  FileSummary,
  LargestFileInfo,
  MarkerFileSummary,
  MarkerSummary,
  MarkerType,
  RepositoryAnalysisError,
} from "../../../types/repository";
import { analysisError, errorDetail } from "./errors";
import { detectLanguage, isRecognizedSourceLanguage } from "./languages";

const ignoredDirectoryNames = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  "build",
  ".next",
  "coverage",
  ".cache",
  ".idea",
  ".vscode",
  "out",
  "vendor",
]);

const markerTypes: MarkerType[] = ["TODO", "FIXME", "HACK", "XXX"];
const binarySampleBytes = 4096;
const maxTextScanBytes = 5 * 1024 * 1024;

export interface ValidatedRepositoryPath {
  inputPath: string;
  absolutePath: string;
  canonicalPath: string;
}

export interface RepositoryScan {
  summary: FileSummary;
  files: FileInfo[];
  directories: string[];
  markers: MarkerSummary;
  errors: RepositoryAnalysisError[];
}

export function shouldIgnoreDirectory(name: string): boolean {
  return ignoredDirectoryNames.has(name);
}

export async function validateRepositoryPath(inputPath: string): Promise<
  | { ok: true; value: ValidatedRepositoryPath }
  | { ok: false; error: RepositoryAnalysisError }
> {
  const trimmedPath = inputPath.trim();

  if (!trimmedPath) {
    return {
      ok: false,
      error: analysisError("EMPTY_PATH", "Enter a repository path to analyze."),
    };
  }

  const absolutePath = path.resolve(trimmedPath);
  let canonicalPath: string;

  try {
    canonicalPath = await fs.realpath(absolutePath);
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {
        ok: false,
        error: analysisError("PATH_NOT_FOUND", "The supplied path does not exist.", {
          path: absolutePath,
          detail: errorDetail(error),
        }),
      };
    }

    if (nodeError.code === "EACCES" || nodeError.code === "EPERM") {
      return {
        ok: false,
        error: analysisError("PATH_ACCESS_DENIED", "The supplied path cannot be accessed.", {
          path: absolutePath,
          detail: errorDetail(error),
        }),
      };
    }

    return {
      ok: false,
      error: analysisError("PATH_RESOLUTION_FAILED", "The supplied path could not be resolved.", {
        path: absolutePath,
        detail: errorDetail(error),
      }),
    };
  }

  try {
    const stats = await fs.stat(canonicalPath);
    if (!stats.isDirectory()) {
      return {
        ok: false,
        error: analysisError("PATH_NOT_DIRECTORY", "The supplied path is not a directory.", {
          path: canonicalPath,
        }),
      };
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: analysisError("FILESYSTEM_ERROR", "The supplied path could not be inspected.", {
        path: canonicalPath,
        detail: errorDetail(error),
      }),
    };
  }

  return {
    ok: true,
    value: {
      inputPath,
      absolutePath,
      canonicalPath,
    },
  };
}

export async function scanRepository(rootPath: string): Promise<RepositoryScan> {
  const files: FileInfo[] = [];
  const directories: string[] = [];
  const errors: RepositoryAnalysisError[] = [];
  const markerCounts = emptyMarkerCounts();
  const markerFiles = new Map<string, number>();
  let directoryCount = 0;

  async function walk(currentPath: string): Promise<void> {
    let entries: Array<{
      name: string;
      isDirectory(): boolean;
      isFile(): boolean;
    }>;

    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error: unknown) {
      errors.push(
        analysisError("FILESYSTEM_ERROR", "A directory could not be read.", {
          path: currentPath,
          detail: errorDetail(error),
        }),
      );
      return;
    }

    for (const entry of entries) {
      const absoluteEntryPath = path.join(currentPath, entry.name);
      const relativePath = toRepositoryPath(rootPath, absoluteEntryPath);

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name)) {
          continue;
        }

        directoryCount += 1;
        directories.push(relativePath);
        await walk(absoluteEntryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      try {
        const stats = await fs.lstat(absoluteEntryPath);
        if (stats.isSymbolicLink()) {
          continue;
        }

        const language = detectLanguage(relativePath);
        const textInfo = await inspectTextFile(absoluteEntryPath, stats.size);
        const isSource = textInfo.isText && isRecognizedSourceLanguage(language);
        const markerInfo = isSource ? countMarkers(textInfo.contentForMarkers) : emptyMarkerCounts();
        const markerTotal = totalMarkers(markerInfo);

        if (markerTotal > 0) {
          markerFiles.set(relativePath, markerTotal);
          for (const marker of markerTypes) {
            markerCounts[marker] += markerInfo[marker];
          }
        }

        files.push({
          path: relativePath,
          bytes: stats.size,
          isBinary: !textInfo.isText,
          isText: textInfo.isText,
          isSource,
          language,
          lineCount: textInfo.lineCount,
        });
      } catch (error: unknown) {
        errors.push(
          analysisError("FILESYSTEM_ERROR", "A file could not be inspected.", {
            path: absoluteEntryPath,
            detail: errorDetail(error),
          }),
        );
      }
    }
  }

  await walk(rootPath);

  const summary: FileSummary = {
    totalFiles: files.length,
    sourceFiles: files.filter((file) => file.isSource).length,
    textFiles: files.filter((file) => file.isText).length,
    binaryFiles: files.filter((file) => file.isBinary).length,
    directoryCount,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    approximateLineCount: files.reduce((total, file) => total + (file.lineCount ?? 0), 0),
    largestFiles: largestFiles(files),
  };

  return {
    summary,
    files,
    directories,
    markers: {
      total: totalMarkers(markerCounts),
      byType: markerCounts,
      files: sortedMarkerFiles(markerFiles),
      topFiles: sortedMarkerFiles(markerFiles).slice(0, 10),
    },
    errors,
  };
}

function sortedMarkerFiles(markerFiles: Map<string, number>): MarkerFileSummary[] {
  return [...markerFiles.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([filePath, count]) => ({ path: filePath, count }));
}

export async function isTextFile(filePath: string): Promise<boolean> {
  const stats = await fs.stat(filePath);
  return inspectTextFile(filePath, stats.size).then((result) => result.isText);
}

function toRepositoryPath(rootPath: string, absoluteEntryPath: string): string {
  const relative = path.relative(rootPath, absoluteEntryPath);
  return relative.split(path.sep).join("/");
}

async function inspectTextFile(
  filePath: string,
  size: number,
): Promise<{ isText: boolean; lineCount?: number; contentForMarkers: string }> {
  const sample = await readSample(filePath, Math.min(binarySampleBytes, size));
  const isText = classifyBufferAsText(sample);

  if (!isText) {
    return { isText: false, contentForMarkers: "" };
  }

  if (size > maxTextScanBytes) {
    return { isText: true, contentForMarkers: "" };
  }

  const content = await fs.readFile(filePath, "utf8");
  return {
    isText: true,
    lineCount: countLines(content),
    contentForMarkers: content,
  };
}

async function readSample(filePath: string, bytes: number): Promise<Buffer> {
  if (bytes === 0) {
    return Buffer.alloc(0);
  }

  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function classifyBufferAsText(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return true;
  }

  let suspiciousBytes = 0;

  for (const byte of buffer) {
    if (byte === 0) {
      return false;
    }

    const isAllowedControl = byte === 7 || byte === 8 || byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 27;
    if (byte < 32 && !isAllowedControl) {
      suspiciousBytes += 1;
    }
  }

  return suspiciousBytes / buffer.length < 0.1;
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  const newlineCount = content.match(/\n/g)?.length ?? 0;
  return content.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function countMarkers(content: string): Record<MarkerType, number> {
  const counts = emptyMarkerCounts();
  for (const marker of markerTypes) {
    counts[marker] = content.match(new RegExp(`\\b${marker}\\b`, "g"))?.length ?? 0;
  }

  return counts;
}

function emptyMarkerCounts(): Record<MarkerType, number> {
  return {
    TODO: 0,
    FIXME: 0,
    HACK: 0,
    XXX: 0,
  };
}

function totalMarkers(counts: Record<MarkerType, number>): number {
  return markerTypes.reduce((total, marker) => total + counts[marker], 0);
}

function largestFiles(files: FileInfo[]): LargestFileInfo[] {
  return [...files]
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
    .slice(0, 10)
    .map((file) => ({
      path: file.path,
      bytes: file.bytes,
      language: file.language,
      isBinary: file.isBinary,
    }));
}
