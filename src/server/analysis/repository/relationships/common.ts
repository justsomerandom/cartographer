import path from "node:path";

import type { DependencyAnalysis, DetectedProject, FileInfo, SourceLanguage, SourceRelationshipError } from "../../../../types/repository";

export interface SourceFile {
  path: string;
  absolutePath: string;
  language: SourceLanguage;
  bytes: number;
  projectId?: string;
}

export const maxSourceRelationshipFileBytes = 512 * 1024;

export function sourceFilesForRelationships(rootPath: string, files: FileInfo[], dependencyAnalysis: DependencyAnalysis): SourceFile[] {
  return files
    .map((file) => sourceFileFor(rootPath, file, dependencyAnalysis.projects))
    .filter((file): file is SourceFile => Boolean(file))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function toAbsolutePath(rootPath: string, relativePath: string): string {
  return path.join(rootPath, ...relativePath.split("/"));
}

export function toRepositoryPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function projectIdForPath(filePath: string, projects: DetectedProject[]): string | undefined {
  const sortedProjects = [...projects].sort((a, b) => b.rootPath.length - a.rootPath.length);

  for (const project of sortedProjects) {
    if (!project.rootPath || filePath === project.rootPath || filePath.startsWith(`${project.rootPath}/`)) {
      return project.id;
    }
  }

  return undefined;
}

export function relationshipError(pathName: string, language: SourceLanguage, error: unknown): SourceRelationshipError {
  return {
    path: pathName,
    language,
    message: error instanceof Error ? error.message : "Source relationship extraction failed.",
  };
}

function sourceFileFor(rootPath: string, file: FileInfo, projects: DetectedProject[]): SourceFile | undefined {
  const language = relationshipLanguage(file.path);
  if (!language || file.isBinary || file.bytes > maxSourceRelationshipFileBytes) {
    return undefined;
  }

  return {
    path: file.path,
    absolutePath: toAbsolutePath(rootPath, file.path),
    language,
    bytes: file.bytes,
    projectId: projectIdForPath(file.path, projects),
  };
}

function relationshipLanguage(filePath: string): SourceLanguage | undefined {
  if (/\.(ts|tsx)$/.test(filePath)) {
    return "typescript";
  }

  if (/\.(js|jsx|mjs|cjs)$/.test(filePath)) {
    return "javascript";
  }

  if (filePath.endsWith(".rs")) {
    return "rust";
  }

  if (filePath.endsWith(".go")) {
    return "go";
  }

  if (filePath.endsWith(".py")) {
    return "python";
  }

  return undefined;
}
