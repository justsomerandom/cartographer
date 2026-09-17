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

const pythonTechnologyRules = [
  { packageName: "django", name: "Django" },
  { packageName: "flask", name: "Flask" },
  { packageName: "fastapi", name: "FastAPI" },
  { packageName: "starlette", name: "Starlette" },
  { packageName: "sqlalchemy", name: "SQLAlchemy" },
  { packageName: "pydantic", name: "Pydantic" },
  { packageName: "pytest", name: "Pytest" },
  { packageName: "numpy", name: "NumPy" },
  { packageName: "pandas", name: "Pandas" },
];

export async function analyzePythonProjects(rootPath: string, files: FileInfo[]): Promise<DetectedProject[]> {
  const pyprojectFiles = files.filter((file) => file.path.endsWith("pyproject.toml"));
  const requirementsFiles = files.filter((file) => file.path.endsWith("requirements.txt"));

  return [
    ...(await Promise.all(pyprojectFiles.map((file) => analyzePyproject(rootPath, file.path)))),
    ...(await Promise.all(requirementsFiles.map((file) => analyzeRequirements(rootPath, file.path)))),
  ];
}

async function analyzePyproject(rootPath: string, manifestPath: string): Promise<DetectedProject> {
  const absoluteManifestPath = path.join(rootPath, ...manifestPath.split("/"));
  const rootRelativePath = projectRootFromManifest(manifestPath);

  try {
    const parsed = parseToml(await fs.readFile(absoluteManifestPath, "utf8"));
    const manifest = asRecord(parsed) ?? {};
    const project = asRecord(manifest.project);
    const tool = asRecord(manifest.tool);
    const poetry = asRecord(tool?.poetry);
    const dependencies = [
      ...readPep621Dependencies(project?.dependencies, "runtime", manifestPath, "project.dependencies"),
      ...readPep621OptionalDependencies(project?.["optional-dependencies"], manifestPath),
      ...readPoetryDependencies(poetry, manifestPath),
    ];
    const packageManager = poetry ? "poetry" : "python";

    return {
      id: projectId("python", manifestPath),
      rootPath: rootRelativePath,
      manifestPath,
      ecosystem: "python",
      name: unknownToString(project?.name) ?? unknownToString(poetry?.name),
      version: unknownToString(project?.version) ?? unknownToString(poetry?.version),
      manifest: {
        path: manifestPath,
        ecosystem: "python",
        kind: "pyproject.toml",
        packageManager,
        lockfiles: await detectPythonLockfiles(rootPath, rootRelativePath),
      },
      packageManager,
      dependencies,
      dependencyGroups: dependencyGroups(dependencies),
      scripts: [],
      technologies: detectPythonTechnologies(dependencies),
      workspace: {
        isWorkspace: false,
        members: [],
      },
      details: {
        buildSystem: buildBackend(manifest),
      },
      errors: [],
    };
  } catch (error: unknown) {
    return emptyPythonProject(manifestPath, rootRelativePath, "pyproject.toml", error);
  }
}

async function analyzeRequirements(rootPath: string, manifestPath: string): Promise<DetectedProject> {
  const absoluteManifestPath = path.join(rootPath, ...manifestPath.split("/"));
  const rootRelativePath = projectRootFromManifest(manifestPath);

  try {
    const content = await fs.readFile(absoluteManifestPath, "utf8");
    const dependencies = content
      .split(/\r?\n/)
      .map((line) => parseRequirementLine(line, manifestPath))
      .filter((dependency): dependency is Dependency => Boolean(dependency))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: projectId("python", manifestPath),
      rootPath: rootRelativePath,
      manifestPath,
      ecosystem: "python",
      name: rootRelativePath || "requirements",
      manifest: {
        path: manifestPath,
        ecosystem: "python",
        kind: "requirements.txt",
        packageManager: "pip",
        lockfiles: [],
      },
      packageManager: "pip",
      dependencies,
      dependencyGroups: dependencyGroups(dependencies),
      scripts: [],
      technologies: detectPythonTechnologies(dependencies),
      workspace: {
        isWorkspace: false,
        members: [],
      },
      details: {},
      errors: [],
    };
  } catch (error: unknown) {
    return emptyPythonProject(manifestPath, rootRelativePath, "requirements.txt", error);
  }
}

function readPep621Dependencies(value: unknown, category: DependencyCategory, manifestPath: string, source: string): Dependency[] {
  return asStringArray(value).map((requirement) => requirementToDependency(requirement, category, manifestPath, source));
}

function readPep621OptionalDependencies(value: unknown, manifestPath: string): Dependency[] {
  const table = asRecord(value);
  if (!table) {
    return [];
  }

  return Object.entries(table).flatMap(([groupName, requirements]) =>
    readPep621Dependencies(requirements, groupName.toLowerCase().includes("test") ? "test" : "optional", manifestPath, `project.optional-dependencies.${groupName}`),
  );
}

function readPoetryDependencies(poetry: Record<string, unknown> | undefined, manifestPath: string): Dependency[] {
  if (!poetry) {
    return [];
  }

  const dependencies = [
    ...readPoetryDependencyTable(asRecord(poetry.dependencies), "runtime", manifestPath, "tool.poetry.dependencies"),
    ...readPoetryDependencyTable(asRecord(poetry["dev-dependencies"]), "development", manifestPath, "tool.poetry.dev-dependencies"),
  ];
  const groupTable = asRecord(poetry.group);

  if (groupTable) {
    for (const [groupName, groupValue] of Object.entries(groupTable)) {
      const groupDependencies = asRecord(asRecord(groupValue)?.dependencies);
      dependencies.push(
        ...readPoetryDependencyTable(
          groupDependencies,
          groupName.toLowerCase().includes("test") ? "test" : "development",
          manifestPath,
          `tool.poetry.group.${groupName}.dependencies`,
        ),
      );
    }
  }

  return dependencies;
}

function readPoetryDependencyTable(
  table: Record<string, unknown> | undefined,
  category: DependencyCategory,
  manifestPath: string,
  source: string,
): Dependency[] {
  if (!table) {
    return [];
  }

  return Object.entries(table)
    .filter(([name]) => name.toLowerCase() !== "python")
    .map(([name, declaration]) => {
      const parsed = poetryDeclaration(declaration);
      return {
        name,
        version: parsed.version,
        category: parsed.optional ? "optional" : category,
        ecosystem: "python" as const,
        manifestPath,
        optional: parsed.optional,
        path: parsed.path,
        git: parsed.git,
        source,
      };
    });
}

function poetryDeclaration(value: unknown): { version?: string; optional?: boolean; path?: string; git?: string } {
  if (typeof value === "string") {
    return { version: value };
  }

  const table = asRecord(value);
  if (!table) {
    return {};
  }

  return {
    version: unknownToString(table.version),
    optional: table.optional === true,
    path: unknownToString(table.path),
    git: unknownToString(table.git),
  };
}

function parseRequirementLine(line: string, manifestPath: string): Dependency | undefined {
  const trimmed = line.replace(/\s+#.*$/, "").trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return undefined;
  }

  if (trimmed.startsWith("-r ") || trimmed.startsWith("--requirement ")) {
    return {
      name: trimmed,
      category: "unknown",
      ecosystem: "python",
      manifestPath,
      source: "requirements include",
    };
  }

  if (trimmed.startsWith("-e ") || trimmed.startsWith("--editable ")) {
    const value = trimmed.replace(/^(-e|--editable)\s+/, "");
    return {
      name: value,
      category: "runtime",
      ecosystem: "python",
      manifestPath,
      path: value,
      source: "editable requirement",
    };
  }

  return requirementToDependency(trimmed, "runtime", manifestPath, "requirements.txt");
}

function requirementToDependency(requirement: string, category: DependencyCategory, manifestPath: string, source: string): Dependency {
  const match = requirement.match(/^([A-Za-z0-9_.-]+)\s*(.*)$/);
  if (!match) {
    return {
      name: requirement,
      category,
      ecosystem: "python",
      manifestPath,
      source,
    };
  }

  return {
    name: match[1],
    version: match[2]?.trim() || undefined,
    category,
    ecosystem: "python",
    manifestPath,
    source,
  };
}

function detectPythonTechnologies(dependencies: Dependency[]): ProjectFramework[] {
  const dependencyNames = new Set(dependencies.map((dependency) => dependency.name.toLowerCase()));
  return pythonTechnologyRules
    .filter((rule) => dependencyNames.has(rule.packageName))
    .map((rule) => ({
      name: rule.name,
      ecosystem: "python" as const,
      evidence: [rule.packageName],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function detectPythonLockfiles(rootPath: string, projectRoot: string): Promise<string[]> {
  const lockfiles = ["poetry.lock", "uv.lock"];
  const found: string[] = [];

  for (const lockfile of lockfiles) {
    const relativePath = projectRoot ? `${projectRoot}/${lockfile}` : lockfile;
    try {
      await fs.access(path.join(rootPath, ...relativePath.split("/")));
      found.push(relativePath);
    } catch {
      // Optional lockfile hint.
    }
  }

  return found;
}

function buildBackend(manifest: Record<string, unknown>): string | null {
  const buildSystem = asRecord(manifest["build-system"]);
  return unknownToString(buildSystem?.["build-backend"]) ?? null;
}

function emptyPythonProject(manifestPath: string, rootPath: string, kind: string, error: unknown): DetectedProject {
  return {
    id: projectId("python", manifestPath),
    rootPath,
    manifestPath,
    ecosystem: "python",
    manifest: {
      path: manifestPath,
      ecosystem: "python",
      kind,
      packageManager: kind === "requirements.txt" ? "pip" : "python",
      lockfiles: [],
    },
    packageManager: kind === "requirements.txt" ? "pip" : "python",
    dependencies: [],
    dependencyGroups: [],
    scripts: [],
    technologies: [],
    workspace: {
      isWorkspace: false,
      members: [],
    },
    details: {},
    errors: [manifestError("python", manifestPath, error)],
  };
}
