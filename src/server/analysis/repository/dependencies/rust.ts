import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseToml } from "smol-toml";

import type { Dependency, DependencyCategory, DetectedProject, FileInfo, ProjectFramework } from "../../../../types/repository";
import {
  asRecord,
  asStringArray,
  dependencyGroups,
  manifestError,
  projectId,
  projectRootFromManifest,
  unknownToString,
} from "./common";

const rustTechnologyRules = [
  { packageName: "tokio", name: "Tokio" },
  { packageName: "axum", name: "Axum" },
  { packageName: "actix-web", name: "Actix Web" },
  { packageName: "rocket", name: "Rocket" },
  { packageName: "serde", name: "Serde" },
  { packageName: "sqlx", name: "SQLx" },
  { packageName: "diesel", name: "Diesel" },
  { packageName: "tonic", name: "Tonic" },
  { packageName: "reqwest", name: "Reqwest" },
  { packageName: "clap", name: "Clap" },
  { packageName: "tracing", name: "Tracing" },
];

export async function analyzeRustProjects(rootPath: string, files: FileInfo[]): Promise<DetectedProject[]> {
  const manifests = files.filter((file) => file.path.endsWith("Cargo.toml"));
  return Promise.all(manifests.map((file) => analyzeCargoToml(rootPath, file.path)));
}

async function analyzeCargoToml(rootPath: string, manifestPath: string): Promise<DetectedProject> {
  const absoluteManifestPath = path.join(rootPath, ...manifestPath.split("/"));
  const rootRelativePath = projectRootFromManifest(manifestPath);

  try {
    const parsed = parseToml(await fs.readFile(absoluteManifestPath, "utf8"));
    const manifest = asRecord(parsed) ?? {};
    const packageInfo = asRecord(manifest.package);
    const workspace = asRecord(manifest.workspace);
    const dependencies = [
      ...readCargoDependencies(manifest.dependencies, "runtime", manifestPath),
      ...readCargoDependencies(manifest["dev-dependencies"], "development", manifestPath),
      ...readCargoDependencies(manifest["build-dependencies"], "build", manifestPath),
    ];
    const features = asRecord(manifest.features);

    return {
      id: projectId("rust", manifestPath),
      rootPath: rootRelativePath,
      manifestPath,
      ecosystem: "rust",
      name: unknownToString(packageInfo?.name),
      version: unknownToString(packageInfo?.version),
      manifest: {
        path: manifestPath,
        ecosystem: "rust",
        kind: "Cargo.toml",
        packageManager: "cargo",
        lockfiles: await detectCargoLockfiles(rootPath, rootRelativePath),
      },
      packageManager: "cargo",
      dependencies,
      dependencyGroups: dependencyGroups(dependencies),
      scripts: [],
      technologies: detectRustTechnologies(dependencies),
      workspace: {
        isWorkspace: Boolean(workspace),
        members: asStringArray(workspace?.members),
      },
      details: {
        edition: unknownToString(packageInfo?.edition) ?? null,
        features: Object.keys(features ?? {}),
      },
      errors: [],
    };
  } catch (error: unknown) {
    return emptyRustProject(manifestPath, rootRelativePath, error);
  }
}

function readCargoDependencies(value: unknown, category: DependencyCategory, manifestPath: string): Dependency[] {
  const table = asRecord(value);
  if (!table) {
    return [];
  }

  return Object.entries(table)
    .map(([name, declaration]) => cargoDependency(name, declaration, category, manifestPath))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function cargoDependency(name: string, declaration: unknown, category: DependencyCategory, manifestPath: string): Dependency {
  if (typeof declaration === "string") {
    return {
      name,
      version: declaration,
      category,
      ecosystem: "rust",
      manifestPath,
    };
  }

  const table = asRecord(declaration);
  if (!table) {
    return {
      name,
      category,
      ecosystem: "rust",
      manifestPath,
    };
  }

  return {
    name,
    version: unknownToString(table.version),
    category: table.optional === true ? "optional" : category,
    ecosystem: "rust",
    manifestPath,
    optional: table.optional === true,
    path: unknownToString(table.path),
    git: unknownToString(table.git),
    features: asStringArray(table.features),
  };
}

function detectRustTechnologies(dependencies: Dependency[]): ProjectFramework[] {
  const dependencyNames = new Set(dependencies.map((dependency) => dependency.name));
  return rustTechnologyRules
    .filter((rule) => dependencyNames.has(rule.packageName))
    .map((rule) => ({
      name: rule.name,
      ecosystem: "rust" as const,
      evidence: [rule.packageName],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function detectCargoLockfiles(rootPath: string, projectRoot: string): Promise<string[]> {
  const lockfilePath = projectRoot ? `${projectRoot}/Cargo.lock` : "Cargo.lock";
  try {
    await fs.access(path.join(rootPath, ...lockfilePath.split("/")));
    return [lockfilePath];
  } catch {
    return [];
  }
}

function emptyRustProject(manifestPath: string, rootPath: string, error: unknown): DetectedProject {
  return {
    id: projectId("rust", manifestPath),
    rootPath,
    manifestPath,
    ecosystem: "rust",
    manifest: {
      path: manifestPath,
      ecosystem: "rust",
      kind: "Cargo.toml",
      packageManager: "cargo",
      lockfiles: [],
    },
    packageManager: "cargo",
    dependencies: [],
    dependencyGroups: [],
    scripts: [],
    technologies: [],
    workspace: {
      isWorkspace: false,
      members: [],
    },
    details: {},
    errors: [manifestError("rust", manifestPath, error)],
  };
}
