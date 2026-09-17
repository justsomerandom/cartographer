import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { analyzeDependencies } from "../../src/server/analysis/repository/dependencies/analyze";
import type { FileInfo } from "../../src/types/repository";

test("node package.json analysis detects dependencies, scripts, workspaces, technologies, and package manager", async (t) => {
  const root = await makeFixture(t);
  await writeJson(root, "package.json", {
    name: "cartographer-node",
    version: "1.0.0",
    private: true,
    packageManager: "pnpm@10.0.0",
    scripts: {
      dev: "next dev",
      test: "vitest",
    },
    dependencies: {
      next: "^16.0.0",
      react: "^19.0.0",
    },
    devDependencies: {
      typescript: "^6.0.0",
      vitest: "^4.0.0",
    },
    peerDependencies: {
      vue: "^3.0.0",
    },
    optionalDependencies: {
      sharp: "^0.34.0",
    },
    workspaces: ["packages/*"],
  });
  await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

  const analysis = await analyzeDependencies(root, [file("package.json"), file("pnpm-lock.yaml")]);
  const project = analysis.projects[0];

  assert.equal(project?.ecosystem, "node");
  assert.equal(project.name, "cartographer-node");
  assert.equal(project.packageManager, "pnpm@10.0.0");
  assert.equal(project.dependencies.length, 6);
  assert.ok(project.scripts.some((script) => script.name === "dev" && script.highlighted));
  assert.deepEqual(project.workspace?.members, ["packages/*"]);
  assert.ok(project.technologies.some((technology) => technology.name === "Next.js"));
  assert.ok(project.technologies.some((technology) => technology.name === "Vitest"));
});

test("rust Cargo.toml analysis detects package metadata, dependency forms, workspace members, features, and technologies", async (t) => {
  const root = await makeFixture(t);
  await writeText(
    root,
    "Cargo.toml",
    `
[package]
name = "cartographer-rust"
version = "0.1.0"
edition = "2021"

[workspace]
members = ["crates/*"]

[dependencies]
serde = "1"
tokio = { version = "1", features = ["full"] }
local-crate = { path = "../local-crate", optional = true }

[dev-dependencies]
pretty_assertions = "1"

[build-dependencies]
cc = "1"

[features]
default = ["serde"]
`,
  );

  const analysis = await analyzeDependencies(root, [file("Cargo.toml")]);
  const project = analysis.projects[0];

  assert.equal(project?.ecosystem, "rust");
  assert.equal(project.name, "cartographer-rust");
  assert.equal(project.version, "0.1.0");
  assert.deepEqual(project.workspace?.members, ["crates/*"]);
  assert.ok(project.dependencies.some((dependency) => dependency.name === "tokio" && dependency.features?.includes("full")));
  assert.ok(project.dependencies.some((dependency) => dependency.name === "local-crate" && dependency.category === "optional"));
  assert.ok(project.dependencies.some((dependency) => dependency.name === "cc" && dependency.category === "build"));
  assert.ok(project.technologies.some((technology) => technology.name === "Tokio"));
  assert.deepEqual(project.details.features, ["default"]);
});

test("go.mod analysis detects module metadata, grouped requirements, indirect dependencies, and replace directives", async (t) => {
  const root = await makeFixture(t);
  await writeText(
    root,
    "go.mod",
    `
module example.com/cartographer

go 1.23
toolchain go1.23.2

require (
  github.com/gin-gonic/gin v1.10.0
  google.golang.org/grpc v1.66.0 // indirect
)

replace example.com/old => ../old
exclude example.com/bad v1.0.0
`,
  );

  const analysis = await analyzeDependencies(root, [file("go.mod")]);
  const project = analysis.projects[0];

  assert.equal(project?.ecosystem, "go");
  assert.equal(project.name, "example.com/cartographer");
  assert.equal(project.version, "1.23");
  assert.ok(project.dependencies.some((dependency) => dependency.name === "github.com/gin-gonic/gin"));
  assert.ok(project.dependencies.some((dependency) => dependency.name === "google.golang.org/grpc" && dependency.indirect));
  assert.ok(project.technologies.some((technology) => technology.name === "Gin"));
  assert.deepEqual(project.details.replace, ["example.com/old => ../old"]);
});

test("python analysis detects pyproject and requirements dependencies without a complete pip parser", async (t) => {
  const root = await makeFixture(t);
  await writeText(
    root,
    "pyproject.toml",
    `
[project]
name = "cartographer-python"
version = "0.2.0"
dependencies = ["fastapi>=0.115", "pydantic>=2"]

[project.optional-dependencies]
test = ["pytest>=8"]

[tool.poetry.dependencies]
python = "^3.12"
sqlalchemy = "^2"

[tool.poetry.group.dev.dependencies]
pandas = "^2"
`,
  );
  await writeText(
    root,
    "requirements.txt",
    `
# base requirements
flask>=3

-r extra.txt
-e ../local-package
`,
  );

  const analysis = await analyzeDependencies(root, [file("pyproject.toml"), file("requirements.txt")]);
  const pyproject = analysis.projects.find((project) => project.manifestPath === "pyproject.toml");
  const requirements = analysis.projects.find((project) => project.manifestPath === "requirements.txt");

  assert.equal(pyproject?.name, "cartographer-python");
  assert.ok(pyproject?.dependencies.some((dependency) => dependency.name === "fastapi" && dependency.version === ">=0.115"));
  assert.ok(pyproject?.dependencies.some((dependency) => dependency.name === "pytest" && dependency.category === "test"));
  assert.ok(pyproject?.dependencies.some((dependency) => dependency.name === "sqlalchemy"));
  assert.ok(pyproject?.technologies.some((technology) => technology.name === "FastAPI"));
  assert.ok(requirements?.dependencies.some((dependency) => dependency.name === "flask" && dependency.version === ">=3"));
  assert.ok(requirements?.dependencies.some((dependency) => dependency.name === "-r extra.txt"));
  assert.ok(requirements?.dependencies.some((dependency) => dependency.path === "../local-package"));
});

test("dependency aggregation handles multiple projects, repeated dependencies, differing declarations, and malformed manifests", async (t) => {
  const root = await makeFixture(t);
  await fs.mkdir(path.join(root, "frontend"), { recursive: true });
  await fs.mkdir(path.join(root, "app"), { recursive: true });
  await writeJson(root, "frontend/package.json", {
    dependencies: {
      react: "^19.0.0",
    },
  });
  await writeJson(root, "app/package.json", {
    dependencies: {
      react: "^18.0.0",
    },
  });
  await writeText(root, "broken/Cargo.toml", "[package\nname = nope");
  await fs.mkdir(path.join(root, "broken"), { recursive: true });
  await writeText(root, "broken/Cargo.toml", "[package\nname = nope");

  const analysis = await analyzeDependencies(root, [file("frontend/package.json"), file("app/package.json"), file("broken/Cargo.toml")]);

  assert.equal(analysis.summary.projectCount, 3);
  assert.ok(analysis.summary.repeatedDependencies.some((dependency) => dependency.name === "react"));
  assert.ok(analysis.summary.differingDeclaredVersions.some((dependency) => dependency.name === "react"));
  assert.equal(analysis.errors.length, 1);
  assert.equal(analysis.errors[0]?.ecosystem, "rust");
});

async function makeFixture(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartographer-deps-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  return root;
}

async function writeJson(root: string, relativePath: string, value: unknown): Promise<void> {
  await writeText(root, relativePath, JSON.stringify(value, null, 2));
}

async function writeText(root: string, relativePath: string, value: string): Promise<void> {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, value.trimStart());
}

function file(filePath: string): FileInfo {
  return {
    path: filePath,
    bytes: 1,
    isBinary: false,
    isText: true,
    isSource: false,
    lineCount: 1,
  };
}
