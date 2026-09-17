import { promises as fs } from "node:fs";

import type {
  DependencyAnalysis,
  FileInfo,
  ImportReference,
  SourceRelationshipAnalysis,
  SourceRelationshipError,
} from "../../../../types/repository";
import { relationshipError, sourceFilesForRelationships } from "./common";
import { buildRelationshipGraph, withImportReferences } from "./graph";
import { extractGoImports } from "./languages/go";
import { extractJavaScriptImports } from "./languages/javascript";
import { extractPythonImports } from "./languages/python";
import { extractRustImports } from "./languages/rust";
import { createResolverContext, resolveImport } from "./resolve";

export async function analyzeSourceRelationships(
  rootPath: string,
  files: FileInfo[],
  dependencyAnalysis: DependencyAnalysis,
): Promise<SourceRelationshipAnalysis> {
  const sourceFiles = sourceFilesForRelationships(rootPath, files, dependencyAnalysis);
  const importReferences: ImportReference[] = [];
  const errors: SourceRelationshipError[] = [];

  for (const sourceFile of sourceFiles) {
    try {
      const content = await fs.readFile(sourceFile.absolutePath, "utf8");
      importReferences.push(...extractImports(sourceFile.path, content, sourceFile.language));
    } catch (error: unknown) {
      errors.push(relationshipError(sourceFile.path, sourceFile.language, error));
    }
  }

  const resolverContext = await createResolverContext(rootPath, sourceFiles);
  const relationships = importReferences.map((reference) => resolveImport(reference, resolverContext));

  return withImportReferences(buildRelationshipGraph(sourceFiles, relationships, importReferences.length, errors), importReferences);
}

export function emptySourceRelationshipAnalysis(): SourceRelationshipAnalysis {
  return {
    modules: [],
    relationships: [],
    importReferences: [],
    unresolvedImports: [],
    cycles: [],
    summary: {
      sourceModulesAnalyzed: 0,
      internalRelationshipCount: 0,
      externalImportCount: 0,
      unresolvedImportCount: 0,
      unsupportedDynamicImportCount: 0,
      isolatedModuleCount: 0,
      cyclicGroupCount: 0,
      crossProjectRelationshipCount: 0,
      mostDependedOn: [],
      highestFanOut: [],
    },
    errors: [],
  };
}

function extractImports(sourcePath: string, content: string, language: ImportReference["language"]): ImportReference[] {
  if (language === "typescript" || language === "javascript") {
    return extractJavaScriptImports(sourcePath, content, language);
  }

  if (language === "rust") {
    return extractRustImports(sourcePath, content);
  }

  if (language === "go") {
    return extractGoImports(sourcePath, content);
  }

  if (language === "python") {
    return extractPythonImports(sourcePath, content);
  }

  return [];
}
