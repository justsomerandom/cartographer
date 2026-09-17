import { promises as fs } from "node:fs";
import path from "node:path";

import type { Dependency, DetectedProject, FileInfo, ProjectFramework, ProjectScript } from "../../../../types/repository";
import {
  asRecord,
  asStringArray,
  asStringRecord,
  dependencyGroups,
  manifestError,
  projectId,
  projectRootFromManifest,
} from "./common";

const nodeDependencySections = [
  { key: "dependencies", category: "runtime" },
  { key: "devDependencies", category: "development" },
  { key: "peerDependencies", category: "peer" },
  { key: "optionalDependencies", category: "optional" },
] as const;

const commonScriptNames = new Set(["dev", "build", "start", "test", "lint", "format", "typecheck"]);

const nodeTechnologyRules = [
  { packageName: "next", name: "Next.js" },
  { packageName: "react", name: "React" },
  { packageName: "vue", name: "Vue" },
  { packageName: "nuxt", name: "Nuxt" },
  { packageName: "svelte", name: "Svelte" },
  { packageName: "@sveltejs/kit", name: "SvelteKit" },
  { packageName: "@angular/core", name: "Angular" },
  { packageName: "express", name: "Express" },
  { packageName: "fastify", name: "Fastify" },
  { packageName: "@nestjs/core", name: "NestJS" },
  { packageName: "vite", name: "Vite" },
  { packageName: "typescript", name: "TypeScript" },
  { packageName: "tailwindcss", name: "Tailwind CSS" },
  { packageName: "eslint", name: "ESLint" },
  { packageName: "jest", name: "Jest" },
  { packageName: "vitest", name: "Vitest" },
  { packageName: "@playwright/test", name: "Playwright" },
  { packageName: "playwright", name: "Playwright" },
  { packageName: "cypress", name: "Cypress" },
];

export async function analyzeNodeProjects(rootPath: string, files: FileInfo[]): Promise<DetectedProject[]> {
  const packageJsonFiles = files.filter((file) => file.path.endsWith("package.json"));
  return Promise.all(packageJsonFiles.map((file) => analyzePackageJson(rootPath, file.path)));
}

async function analyzePackageJson(rootPath: string, manifestPath: string): Promise<DetectedProject> {
  const absoluteManifestPath = path.join(rootPath, ...manifestPath.split("/"));
  const rootRelativePath = projectRootFromManifest(manifestPath);

  try {
    const parsed = JSON.parse(await fs.readFile(absoluteManifestPath, "utf8")) as unknown;
    const manifest = asRecord(parsed) ?? {};
    const dependencies = readNodeDependencies(manifest, manifestPath);
    const lockfiles = await detectLockfiles(rootPath, rootRelativePath);
    const scripts = readScripts(manifest.scripts);
    const packageManager = detectPackageManager(manifest, lockfiles);

    return {
      id: projectId("node", manifestPath),
      rootPath: rootRelativePath,
      manifestPath,
      ecosystem: "node",
      name: typeof manifest.name === "string" ? manifest.name : undefined,
      version: typeof manifest.version === "string" ? manifest.version : undefined,
      private: typeof manifest.private === "boolean" ? manifest.private : undefined,
      packageType: typeof manifest.type === "string" ? manifest.type : undefined,
      packageManager: packageManager ?? undefined,
      engines: asStringRecord(manifest.engines),
      manifest: {
        path: manifestPath,
        ecosystem: "node",
        kind: "package.json",
        packageManager: packageManager ?? undefined,
        lockfiles,
      },
      dependencies,
      dependencyGroups: dependencyGroups(dependencies),
      scripts,
      technologies: detectNodeTechnologies(dependencies),
      workspace: {
        isWorkspace: isWorkspaceManifest(manifest),
        members: workspaceMembers(manifest.workspaces),
      },
      details: {
        packageManager: packageManager ?? null,
      },
      errors: [],
    };
  } catch (error: unknown) {
    return emptyNodeProject(manifestPath, rootRelativePath, error);
  }
}

function readNodeDependencies(manifest: Record<string, unknown>, manifestPath: string): Dependency[] {
  const dependencies: Dependency[] = [];

  for (const section of nodeDependencySections) {
    const values = asStringRecord(manifest[section.key]);
    if (!values) {
      continue;
    }

    for (const [name, version] of Object.entries(values)) {
      dependencies.push({
        name,
        version,
        category: section.category,
        ecosystem: "node",
        manifestPath,
        source: section.key,
      });
    }
  }

  return dependencies.sort((a, b) => a.name.localeCompare(b.name));
}

function readScripts(value: unknown): ProjectScript[] {
  const scripts = asStringRecord(value);
  if (!scripts) {
    return [];
  }

  return Object.entries(scripts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, command]) => ({
      name,
      command,
      highlighted: commonScriptNames.has(name),
    }));
}

function detectNodeTechnologies(dependencies: Dependency[]): ProjectFramework[] {
  const dependencyNames = new Set(dependencies.map((dependency) => dependency.name));
  return nodeTechnologyRules
    .filter((rule) => dependencyNames.has(rule.packageName))
    .map((rule) => ({
      name: rule.name,
      ecosystem: "node" as const,
      evidence: [rule.packageName],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function detectPackageManager(manifest: Record<string, unknown>, lockfiles: string[]): string | null {
  if (typeof manifest.packageManager === "string" && manifest.packageManager.trim()) {
    return manifest.packageManager;
  }

  const filenames = new Set(lockfiles.map((lockfile) => lockfile.split("/").at(-1)));
  if (filenames.has("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (filenames.has("yarn.lock")) {
    return "yarn";
  }

  if (filenames.has("bun.lock") || filenames.has("bun.lockb")) {
    return "bun";
  }

  if (filenames.has("package-lock.json")) {
    return "npm";
  }

  return null;
}

async function detectLockfiles(rootPath: string, projectRoot: string): Promise<string[]> {
  const absoluteRoot = path.join(rootPath, ...projectRoot.split("/").filter(Boolean));
  const lockfiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];
  const found: string[] = [];

  for (const lockfile of lockfiles) {
    try {
      await fs.access(path.join(/*turbopackIgnore: true*/ absoluteRoot, lockfile));
      found.push(projectRoot ? `${projectRoot}/${lockfile}` : lockfile);
    } catch {
      // Lockfiles are optional hints.
    }
  }

  return found;
}

function isWorkspaceManifest(manifest: Record<string, unknown>): boolean {
  return workspaceMembers(manifest.workspaces).length > 0;
}

function workspaceMembers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return asStringArray(value);
  }

  const record = asRecord(value);
  return record ? asStringArray(record.packages) : [];
}

function emptyNodeProject(manifestPath: string, rootPath: string, error: unknown): DetectedProject {
  return {
    id: projectId("node", manifestPath),
    rootPath,
    manifestPath,
    ecosystem: "node",
    manifest: {
      path: manifestPath,
      ecosystem: "node",
      kind: "package.json",
      lockfiles: [],
    },
    dependencies: [],
    dependencyGroups: [],
    scripts: [],
    technologies: [],
    workspace: {
      isWorkspace: false,
      members: [],
    },
    details: {},
    errors: [manifestError("node", manifestPath, error)],
  };
}
