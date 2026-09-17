import { promises as fs } from "node:fs";
import path from "node:path";

import type { ImportReference, ImportResolutionStatus, ResolvedRelationship } from "../../../../types/repository";
import type { SourceFile } from "./common";

interface JavaScriptAliasConfig {
  baseUrl?: string;
  paths: Array<{
    prefix: string;
    suffix: string;
    targets: string[];
  }>;
}

interface ResolverContext {
  rootPath: string;
  sourceFiles: SourceFile[];
  fileSet: Set<string>;
  goModulePath?: string;
  jsAliases: JavaScriptAliasConfig;
}

const jsExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const pythonExtensions = [".py"];
const rustExtensions = [".rs"];

export async function createResolverContext(rootPath: string, sourceFiles: SourceFile[]): Promise<ResolverContext> {
  return {
    rootPath,
    sourceFiles,
    fileSet: new Set(sourceFiles.map((file) => file.path)),
    goModulePath: await readGoModulePath(rootPath),
    jsAliases: await readJavaScriptAliases(rootPath),
  };
}

export function resolveImport(reference: ImportReference, context: ResolverContext): ResolvedRelationship {
  const sourceFile = context.sourceFiles.find((file) => file.path === reference.sourcePath);
  const resolved = resolveTarget(reference, context);
  const targetFile = resolved.targetPath ? context.sourceFiles.find((file) => file.path === resolved.targetPath) : undefined;

  return {
    sourcePath: reference.sourcePath,
    targetPath: resolved.targetPath,
    importText: reference.importText,
    kind: reference.kind,
    status: resolved.status,
    language: reference.language,
    sourceProjectId: sourceFile?.projectId,
    targetProjectId: targetFile?.projectId,
    crossProject: Boolean(sourceFile?.projectId && targetFile?.projectId && sourceFile.projectId !== targetFile.projectId),
    reason: resolved.reason,
  };
}

function resolveTarget(
  reference: ImportReference,
  context: ResolverContext,
): { status: ImportResolutionStatus; targetPath?: string; reason?: string } {
  if (reference.language === "typescript" || reference.language === "javascript") {
    return resolveJavaScriptTarget(reference, context);
  }

  if (reference.language === "rust") {
    return resolveRustTarget(reference, context);
  }

  if (reference.language === "go") {
    return resolveGoTarget(reference, context);
  }

  if (reference.language === "python") {
    return resolvePythonTarget(reference, context);
  }

  return { status: "external", reason: "Unsupported source language." };
}

function resolveJavaScriptTarget(
  reference: ImportReference,
  context: ResolverContext,
): { status: ImportResolutionStatus; targetPath?: string; reason?: string } {
  const importText = reference.importText;
  if (isRelativeImport(importText)) {
    const resolved = resolveFileCandidates(posixJoin(path.posix.dirname(reference.sourcePath), importText), context.fileSet, jsExtensions);
    return resolved ? { status: "internal", targetPath: resolved } : { status: "unresolved-local", reason: "Relative import did not match a source file." };
  }

  const explicitAliasCandidates = explicitAliasCandidatePrefixes(importText, context.jsAliases);
  for (const candidate of explicitAliasCandidates) {
    const resolved = resolveFileCandidates(candidate, context.fileSet, jsExtensions);
    if (resolved) {
      return { status: "internal", targetPath: resolved };
    }
  }

  if (explicitAliasCandidates.length > 0) {
    return { status: "unresolved-local", reason: "Path alias matched but did not resolve to a source file." };
  }

  const baseUrlCandidate = baseUrlCandidatePrefix(importText, context.jsAliases);
  if (baseUrlCandidate) {
    const resolved = resolveFileCandidates(baseUrlCandidate, context.fileSet, jsExtensions);
    if (resolved) {
      return { status: "internal", targetPath: resolved };
    }
  }

  return { status: "external", reason: "Package import." };
}

function resolveRustTarget(
  reference: ImportReference,
  context: ResolverContext,
): { status: ImportResolutionStatus; targetPath?: string; reason?: string } {
  if (reference.kind === "rust-mod") {
    const moduleBase = rustModuleBase(reference.sourcePath);
    const resolved = resolveFileCandidates(`${moduleBase}/${reference.importText}`, context.fileSet, rustExtensions);
    return resolved ? { status: "internal", targetPath: resolved } : { status: "unresolved-local", reason: "Rust mod declaration did not match foo.rs or foo/mod.rs." };
  }

  const parts = reference.importText.split("::").filter(Boolean);
  if (parts.length === 0) {
    return { status: "external", reason: "Empty Rust use path." };
  }

  const first = parts[0];
  if (first === "crate") {
    const resolved = resolveRustPathFromBase(rustCrateRoot(reference.sourcePath), parts.slice(1), context.fileSet);
    return resolved ? { status: "internal", targetPath: resolved } : { status: "unresolved-local", reason: "crate:: path did not resolve to a local module file." };
  }

  if (first === "self") {
    const resolved = resolveRustPathFromBase(rustModuleBase(reference.sourcePath), parts.slice(1), context.fileSet);
    return resolved ? { status: "internal", targetPath: resolved } : { status: "unresolved-local", reason: "self:: path did not resolve to a local module file." };
  }

  if (first === "super") {
    const resolved = resolveRustPathFromBase(path.posix.dirname(rustModuleBase(reference.sourcePath)), parts.slice(1), context.fileSet);
    return resolved ? { status: "internal", targetPath: resolved } : { status: "unresolved-local", reason: "super:: path did not resolve to a local module file." };
  }

  return { status: "external", reason: "Rust path appears to reference an external crate." };
}

function resolveGoTarget(
  reference: ImportReference,
  context: ResolverContext,
): { status: ImportResolutionStatus; targetPath?: string; reason?: string } {
  if (!context.goModulePath || !reference.importText.startsWith(`${context.goModulePath}/`)) {
    return { status: "external", reason: "Standard library or third-party Go import." };
  }

  const packagePath = reference.importText.slice(context.goModulePath.length + 1);
  const goFiles = context.sourceFiles
    .filter((file) => file.language === "go" && path.posix.dirname(file.path) === packagePath)
    .map((file) => file.path)
    .sort();

  return goFiles[0] ? { status: "internal", targetPath: goFiles[0] } : { status: "unresolved-local", reason: "Go module import matched this module but no local package file was found." };
}

function resolvePythonTarget(
  reference: ImportReference,
  context: ResolverContext,
): { status: ImportResolutionStatus; targetPath?: string; reason?: string } {
  if (reference.importText.startsWith(".")) {
    const resolved = resolvePythonRelative(reference, context);
    return resolved ? { status: "internal", targetPath: resolved } : { status: "unresolved-local", reason: "Relative Python import did not resolve to a local module." };
  }

  const modulePath = reference.importText.split(".").join("/");
  const resolved = resolvePythonModule(modulePath, context.fileSet) ?? resolvePythonModule(`src/${modulePath}`, context.fileSet);
  return resolved ? { status: "internal", targetPath: resolved } : { status: "external", reason: "Python import did not match a local module confidently." };
}

function resolvePythonRelative(reference: ImportReference, context: ResolverContext): string | undefined {
  const dotMatch = reference.importText.match(/^(\.+)(.*)$/);
  if (!dotMatch) {
    return undefined;
  }

  let baseDirectory = path.posix.dirname(reference.sourcePath);
  for (let index = 1; index < dotMatch[1].length; index += 1) {
    baseDirectory = path.posix.dirname(baseDirectory);
  }

  const suffix = dotMatch[2].replace(/^\./, "").split(".").filter(Boolean).join("/");
  return resolvePythonModule(suffix ? `${baseDirectory}/${suffix}` : baseDirectory, context.fileSet);
}

function resolveFileCandidates(basePath: string, fileSet: Set<string>, extensions: string[]): string | undefined {
  const normalized = normalizePosix(basePath);
  if (fileSet.has(normalized)) {
    return normalized;
  }

  for (const extension of extensions) {
    if (fileSet.has(`${normalized}${extension}`)) {
      return `${normalized}${extension}`;
    }
  }

  for (const extension of extensions) {
    const indexPath = `${normalized}/index${extension}`;
    if (fileSet.has(indexPath)) {
      return indexPath;
    }
  }

  return undefined;
}

function resolvePythonModule(modulePath: string, fileSet: Set<string>): string | undefined {
  const normalized = normalizePosix(modulePath);
  return resolveFileCandidates(normalized, fileSet, pythonExtensions) ?? (fileSet.has(`${normalized}/__init__.py`) ? `${normalized}/__init__.py` : undefined);
}

function resolveRustPathFromBase(basePath: string, parts: string[], fileSet: Set<string>): string | undefined {
  if (parts.length === 0) {
    return undefined;
  }

  const candidates = parts.map((_part, index) => `${basePath}/${parts.slice(0, index + 1).join("/")}`);
  for (const candidate of candidates.reverse()) {
    const resolved = resolveFileCandidates(candidate, fileSet, rustExtensions) ?? (fileSet.has(`${candidate}/mod.rs`) ? `${candidate}/mod.rs` : undefined);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function rustModuleBase(sourcePath: string): string {
  if (sourcePath.endsWith("/mod.rs")) {
    return path.posix.dirname(sourcePath);
  }

  if (sourcePath.endsWith("/lib.rs") || sourcePath.endsWith("/main.rs")) {
    return path.posix.dirname(sourcePath);
  }

  return sourcePath.replace(/\.rs$/, "");
}

function rustCrateRoot(sourcePath: string): string {
  const srcIndex = sourcePath.split("/").lastIndexOf("src");
  if (srcIndex >= 0) {
    return sourcePath.split("/").slice(0, srcIndex + 1).join("/");
  }

  return path.posix.dirname(sourcePath);
}

function explicitAliasCandidatePrefixes(importText: string, aliases: JavaScriptAliasConfig): string[] {
  const candidates: string[] = [];
  for (const alias of aliases.paths) {
    if (!importText.startsWith(alias.prefix) || !importText.endsWith(alias.suffix)) {
      continue;
    }

    const wildcardValue = importText.slice(alias.prefix.length, importText.length - alias.suffix.length);
    for (const target of alias.targets) {
      candidates.push(normalizePosix(target.replace("*", wildcardValue)));
    }
  }

  return candidates;
}

function baseUrlCandidatePrefix(importText: string, aliases: JavaScriptAliasConfig): string | undefined {
  return aliases.baseUrl ? normalizePosix(`${aliases.baseUrl}/${importText}`) : undefined;
}

async function readJavaScriptAliases(rootPath: string): Promise<JavaScriptAliasConfig> {
  for (const configName of ["tsconfig.json", "jsconfig.json"]) {
    try {
      const parsed = JSON.parse(stripJsonComments(await fs.readFile(path.join(/*turbopackIgnore: true*/ rootPath, configName), "utf8"))) as {
        compilerOptions?: {
          baseUrl?: string;
          paths?: Record<string, string[]>;
        };
      };
      const compilerOptions = parsed.compilerOptions ?? {};
      return {
        baseUrl: compilerOptions.baseUrl ? normalizePosix(compilerOptions.baseUrl) : undefined,
        paths: Object.entries(compilerOptions.paths ?? {}).map(([alias, targets]) => {
          const [prefix, suffix = ""] = alias.split("*");
          return {
            prefix,
            suffix,
            targets: targets.map((target) => normalizePosix(`${compilerOptions.baseUrl ?? ""}/${target}`)),
          };
        }),
      };
    } catch {
      // Config files are optional.
    }
  }

  return { paths: [] };
}

async function readGoModulePath(rootPath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(path.join(rootPath, "go.mod"), "utf8");
    return content.match(/^module\s+(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

function stripJsonComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function isRelativeImport(importText: string): boolean {
  return importText.startsWith("./") || importText.startsWith("../") || importText === "." || importText === "..";
}

function posixJoin(...parts: string[]): string {
  return normalizePosix(path.posix.join(...parts));
}

function normalizePosix(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/");
}
