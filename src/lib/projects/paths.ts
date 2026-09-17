import path from "node:path";

export interface NormalizedProjectPath {
  path: string;
  pathKey: string;
  name: string;
}

export function normalizeSavedProjectPath(absolutePath: string): NormalizedProjectPath {
  const normalizedPath = path.normalize(absolutePath);

  return {
    path: normalizedPath,
    pathKey: process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath,
    name: path.basename(normalizedPath) || normalizedPath,
  };
}
