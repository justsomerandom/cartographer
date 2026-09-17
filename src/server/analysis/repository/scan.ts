import type { FileInfo, LanguageSummary } from "../../../types/repository";

export function summarizeLanguages(files: FileInfo[]): LanguageSummary[] {
  const sourceFiles = files.filter((file) => file.isSource && file.language);
  const totalSourceLines = sourceFiles.reduce((total, file) => total + (file.lineCount ?? 0), 0);
  const totalSourceBytes = sourceFiles.reduce((total, file) => total + file.bytes, 0);
  const stats = new Map<string, { fileCount: number; lineCount: number; byteCount: number }>();

  for (const file of sourceFiles) {
    const language = file.language ?? "Unknown";
    const current = stats.get(language) ?? { fileCount: 0, lineCount: 0, byteCount: 0 };
    current.fileCount += 1;
    current.lineCount += file.lineCount ?? 0;
    current.byteCount += file.bytes;
    stats.set(language, current);
  }

  return [...stats.entries()]
    .map(([language, summary]) => ({
      language,
      fileCount: summary.fileCount,
      lineCount: summary.lineCount,
      byteCount: summary.byteCount,
      percentage: percentage(totalSourceLines > 0 ? summary.lineCount : summary.byteCount, totalSourceLines || totalSourceBytes),
    }))
    .sort((a, b) => b.percentage - a.percentage || b.lineCount - a.lineCount || a.language.localeCompare(b.language));
}

function percentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 1000) / 10;
}
