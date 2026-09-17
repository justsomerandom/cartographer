import type {
  Dependency,
  DependencyAnalysis,
  DependencyAnalysisSummary,
  DependencyCategory,
  DependencyEcosystem,
  DetectedProject,
  EcosystemDependencySummary,
  FileInfo,
  RepeatedDependency,
} from "../../../../types/repository";
import { dedupeFrameworks, normalizeDependencyName, sortProjects } from "./common";
import { analyzeGoProjects } from "./go";
import { analyzeNodeProjects } from "./node";
import { analyzePythonProjects } from "./python";
import { analyzeRustProjects } from "./rust";

export async function analyzeDependencies(rootPath: string, files: FileInfo[]): Promise<DependencyAnalysis> {
  const projects = sortProjects(
    (
      await Promise.all([
        analyzeNodeProjects(rootPath, files),
        analyzeRustProjects(rootPath, files),
        analyzeGoProjects(rootPath, files),
        analyzePythonProjects(rootPath, files),
      ])
    ).flat(),
  );

  return {
    projects,
    summary: summarizeDependencyAnalysis(projects),
    errors: projects.flatMap((project) => project.errors),
  };
}

export function emptyDependencyAnalysis(): DependencyAnalysis {
  return {
    projects: [],
    summary: emptyDependencySummary(),
    errors: [],
  };
}

function summarizeDependencyAnalysis(projects: DetectedProject[]): DependencyAnalysisSummary {
  const dependencies = projects.flatMap((project) => project.dependencies);
  const ecosystemSummaries = summarizeEcosystems(projects);
  const repeatedDependencies = findRepeatedDependencies(dependencies);

  return {
    projectCount: projects.length,
    manifestCount: projects.length,
    totalDirectDependencies: dependencies.length,
    runtimeDependencyCount: countCategory(dependencies, "runtime"),
    developmentDependencyCount: countCategories(dependencies, ["development", "test"]),
    optionalDependencyCount: countCategory(dependencies, "optional"),
    peerDependencyCount: countCategory(dependencies, "peer"),
    buildDependencyCount: countCategory(dependencies, "build"),
    testDependencyCount: countCategory(dependencies, "test"),
    ecosystemSummaries,
    technologies: dedupeFrameworks(projects.flatMap((project) => project.technologies)),
    repeatedDependencies,
    differingDeclaredVersions: repeatedDependencies.filter(hasDifferingVersions),
  };
}

function emptyDependencySummary(): DependencyAnalysisSummary {
  return {
    projectCount: 0,
    manifestCount: 0,
    totalDirectDependencies: 0,
    runtimeDependencyCount: 0,
    developmentDependencyCount: 0,
    optionalDependencyCount: 0,
    peerDependencyCount: 0,
    buildDependencyCount: 0,
    testDependencyCount: 0,
    ecosystemSummaries: [],
    technologies: [],
    repeatedDependencies: [],
    differingDeclaredVersions: [],
  };
}

function summarizeEcosystems(projects: DetectedProject[]): EcosystemDependencySummary[] {
  const byEcosystem = new Map<DependencyEcosystem, { projectCount: number; dependencyCount: number }>();

  for (const project of projects) {
    const summary = byEcosystem.get(project.ecosystem) ?? { projectCount: 0, dependencyCount: 0 };
    summary.projectCount += 1;
    summary.dependencyCount += project.dependencies.length;
    byEcosystem.set(project.ecosystem, summary);
  }

  return [...byEcosystem.entries()]
    .map(([ecosystem, summary]) => ({
      ecosystem,
      projectCount: summary.projectCount,
      dependencyCount: summary.dependencyCount,
    }))
    .sort((a, b) => b.projectCount - a.projectCount || a.ecosystem.localeCompare(b.ecosystem));
}

function findRepeatedDependencies(dependencies: Dependency[]): RepeatedDependency[] {
  const byDependency = new Map<string, RepeatedDependency>();

  for (const dependency of dependencies) {
    const key = `${dependency.ecosystem}:${normalizeDependencyName(dependency.name)}`;
    const current =
      byDependency.get(key) ??
      ({
        ecosystem: dependency.ecosystem,
        name: dependency.name,
        declarations: [],
      } satisfies RepeatedDependency);

    current.declarations.push({
      manifestPath: dependency.manifestPath,
      version: dependency.version,
    });
    byDependency.set(key, current);
  }

  return [...byDependency.values()]
    .filter((dependency) => new Set(dependency.declarations.map((declaration) => declaration.manifestPath)).size > 1)
    .map((dependency) => ({
      ...dependency,
      declarations: dependency.declarations.sort((a, b) => a.manifestPath.localeCompare(b.manifestPath)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function hasDifferingVersions(dependency: RepeatedDependency): boolean {
  const versions = new Set(dependency.declarations.map((declaration) => declaration.version ?? ""));
  return versions.size > 1;
}

function countCategory(dependencies: Dependency[], category: DependencyCategory): number {
  return dependencies.filter((dependency) => dependency.category === category).length;
}

function countCategories(dependencies: Dependency[], categories: DependencyCategory[]): number {
  const categorySet = new Set(categories);
  return dependencies.filter((dependency) => categorySet.has(dependency.category)).length;
}
