import type {
  DependencyCycle,
  ImportResolutionStatus,
  ModuleDegree,
  RelationshipSummary,
  ResolvedRelationship,
  SourceModule,
  SourceRelationshipAnalysis,
  SourceRelationshipError,
} from "../../../../types/repository";
import type { SourceFile } from "./common";

export function buildRelationshipGraph(
  sourceFiles: SourceFile[],
  relationships: ResolvedRelationship[],
  importReferenceCount: number,
  errors: SourceRelationshipError[],
): SourceRelationshipAnalysis {
  const internalRelationships = dedupeInternalRelationships(relationships);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const externalCounts = new Map<string, number>();
  const unresolvedCounts = new Map<string, number>();
  const modulesByPath = new Map(sourceFiles.map((file) => [file.path, file]));

  for (const relationship of relationships) {
    if (relationship.status === "internal" && relationship.targetPath) {
      outgoing.set(relationship.sourcePath, (outgoing.get(relationship.sourcePath) ?? 0) + 1);
      incoming.set(relationship.targetPath, (incoming.get(relationship.targetPath) ?? 0) + 1);
    } else if (relationship.status === "external") {
      externalCounts.set(relationship.sourcePath, (externalCounts.get(relationship.sourcePath) ?? 0) + 1);
    } else if (relationship.status === "unresolved-local" || relationship.status === "unsupported-dynamic") {
      unresolvedCounts.set(relationship.sourcePath, (unresolvedCounts.get(relationship.sourcePath) ?? 0) + 1);
    }
  }

  const modules: SourceModule[] = sourceFiles.map((file) => ({
    path: file.path,
    language: file.language,
    projectId: file.projectId,
    incomingCount: incoming.get(file.path) ?? 0,
    outgoingCount: outgoing.get(file.path) ?? 0,
    externalImportCount: externalCounts.get(file.path) ?? 0,
    unresolvedImportCount: unresolvedCounts.get(file.path) ?? 0,
  }));
  const cycles = findCycles(sourceFiles, internalRelationships);
  const unresolvedImports = relationships
    .filter(
      (
        relationship,
      ): relationship is ResolvedRelationship & {
        status: Exclude<ImportResolutionStatus, "internal">;
      } => relationship.status !== "internal",
    )
    .map((relationship) => ({
      sourcePath: relationship.sourcePath,
      language: relationship.language,
      importText: relationship.importText,
      kind: relationship.kind,
      status: relationship.status,
      reason: relationship.reason ?? "Import was not resolved internally.",
    }));

  return {
    modules,
    relationships: [...internalRelationships, ...relationships.filter((relationship) => relationship.status !== "internal")],
    importReferences: [],
    unresolvedImports,
    cycles,
    summary: summarize(modules, internalRelationships, relationships, cycles, modulesByPath),
    errors: errors.slice(0, 25),
  };
}

export function withImportReferences(
  analysis: SourceRelationshipAnalysis,
  importReferences: SourceRelationshipAnalysis["importReferences"],
): SourceRelationshipAnalysis {
  return {
    ...analysis,
    importReferences,
  };
}

function summarize(
  modules: SourceModule[],
  internalRelationships: ResolvedRelationship[],
  relationships: ResolvedRelationship[],
  cycles: DependencyCycle[],
  modulesByPath: Map<string, SourceFile>,
): RelationshipSummary {
  return {
    sourceModulesAnalyzed: modules.length,
    internalRelationshipCount: internalRelationships.length,
    externalImportCount: relationships.filter((relationship) => relationship.status === "external").length,
    unresolvedImportCount: relationships.filter((relationship) => relationship.status === "unresolved-local").length,
    unsupportedDynamicImportCount: relationships.filter((relationship) => relationship.status === "unsupported-dynamic").length,
    isolatedModuleCount: modules.filter((module) => module.incomingCount === 0 && module.outgoingCount === 0).length,
    cyclicGroupCount: cycles.length,
    crossProjectRelationshipCount: internalRelationships.filter((relationship) => relationship.crossProject).length,
    mostDependedOn: topModules(modules, "incomingCount", modulesByPath),
    highestFanOut: topModules(modules, "outgoingCount", modulesByPath),
  };
}

function topModules(
  modules: SourceModule[],
  field: "incomingCount" | "outgoingCount",
  modulesByPath: Map<string, SourceFile>,
): ModuleDegree[] {
  return modules
    .filter((module) => module[field] > 0)
    .sort((a, b) => b[field] - a[field] || a.path.localeCompare(b.path))
    .slice(0, 10)
    .map((module) => ({
      path: module.path,
      language: module.language,
      count: module[field],
      projectId: modulesByPath.get(module.path)?.projectId,
    }));
}

function dedupeInternalRelationships(relationships: ResolvedRelationship[]): ResolvedRelationship[] {
  return [
    ...new Map(
      relationships
        .filter((relationship) => relationship.status === "internal" && relationship.targetPath && relationship.sourcePath !== relationship.targetPath)
        .map((relationship) => [`${relationship.sourcePath}->${relationship.targetPath}`, relationship]),
    ).values(),
  ].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || (a.targetPath ?? "").localeCompare(b.targetPath ?? ""));
}

function findCycles(sourceFiles: SourceFile[], relationships: ResolvedRelationship[]): DependencyCycle[] {
  const graph = new Map<string, string[]>();
  for (const file of sourceFiles) {
    graph.set(file.path, []);
  }

  for (const relationship of relationships) {
    if (relationship.targetPath) {
      graph.get(relationship.sourcePath)?.push(relationship.targetPath);
    }
  }

  let index = 0;
  const stack: string[] = [];
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const onStack = new Set<string>();
  const cycles: DependencyCycle[] = [];

  function strongConnect(node: string): void {
    indices.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of graph.get(node) ?? []) {
      if (!indices.has(target)) {
        strongConnect(target);
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, lowLinks.get(target) ?? 0));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, indices.get(target) ?? 0));
      }
    }

    if (lowLinks.get(node) === indices.get(node)) {
      const component: string[] = [];
      let current: string | undefined;
      do {
        current = stack.pop();
        if (current) {
          onStack.delete(current);
          component.push(current);
        }
      } while (current && current !== node);

      if (component.length > 1) {
        cycles.push({ modules: component.sort() });
      }
    }
  }

  for (const node of [...graph.keys()].sort()) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }

  return cycles.sort((a, b) => a.modules[0].localeCompare(b.modules[0]));
}
