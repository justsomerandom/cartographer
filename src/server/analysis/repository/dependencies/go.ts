import { promises as fs } from "node:fs";
import path from "node:path";

import type { Dependency, DetectedProject, FileInfo, ProjectFramework } from "../../../../types/repository";
import { dependencyGroups, manifestError, projectId, projectRootFromManifest } from "./common";

const goTechnologyRules = [
  { modulePrefix: "github.com/gin-gonic/gin", name: "Gin" },
  { modulePrefix: "github.com/labstack/echo", name: "Echo" },
  { modulePrefix: "github.com/gofiber/fiber", name: "Fiber" },
  { modulePrefix: "github.com/spf13/cobra", name: "Cobra" },
  { modulePrefix: "gorm.io/gorm", name: "GORM" },
  { modulePrefix: "google.golang.org/grpc", name: "gRPC" },
];

export async function analyzeGoProjects(rootPath: string, files: FileInfo[]): Promise<DetectedProject[]> {
  const manifests = files.filter((file) => file.path.endsWith("go.mod"));
  return Promise.all(manifests.map((file) => analyzeGoMod(rootPath, file.path)));
}

async function analyzeGoMod(rootPath: string, manifestPath: string): Promise<DetectedProject> {
  const absoluteManifestPath = path.join(rootPath, ...manifestPath.split("/"));
  const rootRelativePath = projectRootFromManifest(manifestPath);

  try {
    const content = await fs.readFile(absoluteManifestPath, "utf8");
    const parsed = parseGoMod(content, manifestPath);

    return {
      id: projectId("go", manifestPath),
      rootPath: rootRelativePath,
      manifestPath,
      ecosystem: "go",
      name: parsed.modulePath,
      version: parsed.goVersion ?? undefined,
      manifest: {
        path: manifestPath,
        ecosystem: "go",
        kind: "go.mod",
        packageManager: "go",
        lockfiles: await detectGoSum(rootPath, rootRelativePath),
      },
      packageManager: "go",
      dependencies: parsed.dependencies,
      dependencyGroups: dependencyGroups(parsed.dependencies),
      scripts: [],
      technologies: detectGoTechnologies(parsed.dependencies),
      workspace: {
        isWorkspace: false,
        members: [],
      },
      details: {
        module: parsed.modulePath,
        goVersion: parsed.goVersion,
        toolchain: parsed.toolchain,
        replace: parsed.replace,
        exclude: parsed.exclude,
      },
      errors: [],
    };
  } catch (error: unknown) {
    return emptyGoProject(manifestPath, rootRelativePath, error);
  }
}

function parseGoMod(content: string, manifestPath: string): {
  modulePath: string;
  goVersion: string | null;
  toolchain: string | null;
  dependencies: Dependency[];
  replace: string[];
  exclude: string[];
} {
  const lines = content.split(/\r?\n/);
  const dependencies: Dependency[] = [];
  const replace: string[] = [];
  const exclude: string[] = [];
  let modulePath = "";
  let goVersion: string | null = null;
  let toolchain: string | null = null;
  let block: "require" | "replace" | "exclude" | null = null;

  for (const rawLine of lines) {
    const line = stripGoComment(rawLine).trim();
    if (!line) {
      continue;
    }

    if (line === ")") {
      block = null;
      continue;
    }

    if (line === "require (") {
      block = "require";
      continue;
    }

    if (line === "replace (") {
      block = "replace";
      continue;
    }

    if (line === "exclude (") {
      block = "exclude";
      continue;
    }

    if (line.startsWith("module ")) {
      modulePath = line.slice("module ".length).trim();
      continue;
    }

    if (line.startsWith("go ")) {
      goVersion = line.slice("go ".length).trim();
      continue;
    }

    if (line.startsWith("toolchain ")) {
      toolchain = line.slice("toolchain ".length).trim();
      continue;
    }

    if (line.startsWith("require ")) {
      const dependency = parseGoRequire(line.slice("require ".length), manifestPath);
      if (dependency) {
        dependencies.push(dependency);
      }
      continue;
    }

    if (line.startsWith("replace ")) {
      replace.push(line.slice("replace ".length).trim());
      continue;
    }

    if (line.startsWith("exclude ")) {
      exclude.push(line.slice("exclude ".length).trim());
      continue;
    }

    if (block === "require") {
      const dependency = parseGoRequire(line, manifestPath);
      if (dependency) {
        dependencies.push(dependency);
      }
    } else if (block === "replace") {
      replace.push(line);
    } else if (block === "exclude") {
      exclude.push(line);
    }
  }

  return {
    modulePath,
    goVersion,
    toolchain,
    dependencies: dependencies.sort((a, b) => a.name.localeCompare(b.name)),
    replace,
    exclude,
  };
}

function parseGoRequire(line: string, manifestPath: string): Dependency | undefined {
  const parts = line.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return undefined;
  }

  const indirect = line.includes("// indirect");
  return {
    name: parts[0],
    version: parts[1],
    category: "runtime",
    ecosystem: "go",
    manifestPath,
    indirect,
  };
}

function stripGoComment(line: string): string {
  const indirectComment = line.includes("// indirect") ? " // indirect" : "";
  const commentStart = line.indexOf("//");
  return commentStart >= 0 ? `${line.slice(0, commentStart)}${indirectComment}` : line;
}

function detectGoTechnologies(dependencies: Dependency[]): ProjectFramework[] {
  return goTechnologyRules
    .filter((rule) => dependencies.some((dependency) => dependency.name.startsWith(rule.modulePrefix)))
    .map((rule) => ({
      name: rule.name,
      ecosystem: "go" as const,
      evidence: [rule.modulePrefix],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function detectGoSum(rootPath: string, projectRoot: string): Promise<string[]> {
  const lockfilePath = projectRoot ? `${projectRoot}/go.sum` : "go.sum";
  try {
    await fs.access(path.join(rootPath, ...lockfilePath.split("/")));
    return [lockfilePath];
  } catch {
    return [];
  }
}

function emptyGoProject(manifestPath: string, rootPath: string, error: unknown): DetectedProject {
  return {
    id: projectId("go", manifestPath),
    rootPath,
    manifestPath,
    ecosystem: "go",
    manifest: {
      path: manifestPath,
      ecosystem: "go",
      kind: "go.mod",
      packageManager: "go",
      lockfiles: [],
    },
    packageManager: "go",
    dependencies: [],
    dependencyGroups: [],
    scripts: [],
    technologies: [],
    workspace: {
      isWorkspace: false,
      members: [],
    },
    details: {},
    errors: [manifestError("go", manifestPath, error)],
  };
}
