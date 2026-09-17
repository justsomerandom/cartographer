import path from "node:path";

import type {
  Dependency,
  DependencyCategory,
  DependencyEcosystem,
  DependencyGroup,
  DetectedProject,
  ManifestAnalysisError,
  ProjectFramework,
} from "../../../../types/repository";

export function repositoryRelativePath(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).split(path.sep).join("/");
}

export function projectRootFromManifest(manifestPath: string): string {
  const rootPath = path.posix.dirname(manifestPath);
  return rootPath === "." ? "" : rootPath;
}

export function projectId(ecosystem: DependencyEcosystem, manifestPath: string): string {
  return `${ecosystem}:${manifestPath}`;
}

export function dependencyGroups(dependencies: Dependency[]): DependencyGroup[] {
  const counts = new Map<DependencyCategory, number>();
  for (const dependency of dependencies) {
    counts.set(dependency.category, (counts.get(dependency.category) ?? 0) + 1);
  }

  const categoryOrder: DependencyCategory[] = ["runtime", "development", "test", "build", "optional", "peer", "unknown"];
  return categoryOrder
    .filter((category) => counts.has(category))
    .map((category) => ({
      category,
      count: counts.get(category) ?? 0,
    }));
}

export function manifestError(ecosystem: DependencyEcosystem, manifestPath: string, error: unknown): ManifestAnalysisError {
  return {
    ecosystem,
    manifestPath,
    message: error instanceof Error ? error.message : "Manifest could not be parsed.",
  };
}

export function normalizeDependencyName(name: string): string {
  return name.trim().toLowerCase();
}

export function dedupeFrameworks(frameworks: ProjectFramework[]): ProjectFramework[] {
  const byKey = new Map<string, ProjectFramework>();

  for (const framework of frameworks) {
    const key = `${framework.ecosystem}:${framework.name.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...framework,
        evidence: [...framework.evidence].sort(),
      });
      continue;
    }

    existing.evidence = [...new Set([...existing.evidence, ...framework.evidence])].sort();
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function sortProjects(projects: DetectedProject[]): DetectedProject[] {
  return [...projects].sort((a, b) => a.manifestPath.localeCompare(b.manifestPath));
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

export function asStringRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string") {
      output[key] = entry;
    }
  }

  return output;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function unknownToString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}
