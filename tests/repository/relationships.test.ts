import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { analyzeDependencies, emptyDependencyAnalysis } from "../../src/server/analysis/repository/dependencies/analyze";
import { analyzeSourceRelationships } from "../../src/server/analysis/repository/relationships/analyze";
import type { DependencyAnalysis, FileInfo } from "../../src/types/repository";

test("typescript relationships resolve relative imports, index files, re-exports, require, aliases, externals, and cycles", async (t) => {
  const root = await makeFixture(t);
  await writeText(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        baseUrl: "src",
        paths: {
          "@/*": ["*"],
        },
      },
    }),
  );
  await writeText(
    root,
    "src/a.ts",
    `
import value from "./b";
import "./dir";
export * from "./c";
const again = require("./b");
const aliased = require("@/aliased");
import("react");
`,
  );
  await writeText(root, "src/b.ts", "export const b = 1;");
  await writeText(root, "src/c.ts", "export const c = 1;");
  await writeText(root, "src/dir/index.ts", "export const index = 1;");
  await writeText(root, "src/aliased.ts", "export const aliased = 1;");
  await writeText(root, "src/x.ts", 'import "./y";');
  await writeText(root, "src/y.ts", 'import "./x";');
  const files = ["src/a.ts", "src/b.ts", "src/c.ts", "src/dir/index.ts", "src/aliased.ts", "src/x.ts", "src/y.ts"].map(file);

  const analysis = await analyzeSourceRelationships(root, files, emptyDependencyAnalysis());

  assert.ok(hasEdge(analysis, "src/a.ts", "src/b.ts"));
  assert.equal(analysis.relationships.filter((relationship) => relationship.sourcePath === "src/a.ts" && relationship.targetPath === "src/b.ts").length, 1);
  assert.ok(hasEdge(analysis, "src/a.ts", "src/dir/index.ts"));
  assert.ok(hasEdge(analysis, "src/a.ts", "src/c.ts"));
  assert.ok(hasEdge(analysis, "src/a.ts", "src/aliased.ts"));
  assert.ok(analysis.unresolvedImports.some((entry) => entry.importText === "react" && entry.status === "external"));
  assert.ok(analysis.cycles.some((cycle) => cycle.modules.includes("src/x.ts") && cycle.modules.includes("src/y.ts")));
  assert.equal(analysis.summary.internalRelationshipCount, 6);
});

test("rust relationships resolve mod declarations and crate paths while keeping external crates external", async (t) => {
  const root = await makeFixture(t);
  await writeText(
    root,
    "src/lib.rs",
    `
mod foo;
use crate::foo::bar;
use serde::Serialize;
`,
  );
  await writeText(root, "src/foo.rs", "mod bar;");
  await writeText(root, "src/foo/bar.rs", "pub fn run() {}");
  const files = ["src/lib.rs", "src/foo.rs", "src/foo/bar.rs"].map(file);

  const analysis = await analyzeSourceRelationships(root, files, emptyDependencyAnalysis());

  assert.ok(hasEdge(analysis, "src/lib.rs", "src/foo.rs"));
  assert.ok(hasEdge(analysis, "src/lib.rs", "src/foo/bar.rs"));
  assert.ok(hasEdge(analysis, "src/foo.rs", "src/foo/bar.rs"));
  assert.ok(analysis.unresolvedImports.some((entry) => entry.importText === "serde::Serialize" && entry.status === "external"));
});

test("go relationships resolve imports inside the go.mod module and leave standard library imports external", async (t) => {
  const root = await makeFixture(t);
  await writeText(root, "go.mod", "module github.com/acme/cartographer\n\ngo 1.23\n");
  await writeText(
    root,
    "cmd/app/main.go",
    `
package main

import (
  "fmt"
  "github.com/acme/cartographer/internal/foo"
)
`,
  );
  await writeText(root, "internal/foo/foo.go", "package foo\n");

  const analysis = await analyzeSourceRelationships(root, ["cmd/app/main.go", "internal/foo/foo.go"].map(file), emptyDependencyAnalysis());

  assert.ok(hasEdge(analysis, "cmd/app/main.go", "internal/foo/foo.go"));
  assert.ok(analysis.unresolvedImports.some((entry) => entry.importText === "fmt" && entry.status === "external"));
});

test("python relationships resolve relative imports and src-layout packages conservatively", async (t) => {
  const root = await makeFixture(t);
  await writeText(
    root,
    "src/pkg/a.py",
    `
from . import b
import requests
`,
  );
  await writeText(root, "src/pkg/b.py", "VALUE = 1\n");
  await writeText(root, "src/pkg/__init__.py", "");

  const analysis = await analyzeSourceRelationships(root, ["src/pkg/a.py", "src/pkg/b.py", "src/pkg/__init__.py"].map(file), emptyDependencyAnalysis());

  assert.ok(hasEdge(analysis, "src/pkg/a.py", "src/pkg/b.py"));
  assert.ok(analysis.unresolvedImports.some((entry) => entry.importText === "requests" && entry.status === "external"));
});

test("relationship analysis associates modules with detected projects and counts cross-project edges", async (t) => {
  const root = await makeFixture(t);
  await writeJson(root, "frontend/package.json", { name: "frontend" });
  await writeJson(root, "shared/package.json", { name: "shared" });
  await writeText(root, "frontend/app.ts", 'import "../shared/util";');
  await writeText(root, "shared/util.ts", "export const value = 1;");
  const files = ["frontend/package.json", "shared/package.json", "frontend/app.ts", "shared/util.ts"].map(file);
  const dependencyAnalysis: DependencyAnalysis = await analyzeDependencies(root, files);

  const analysis = await analyzeSourceRelationships(root, files, dependencyAnalysis);

  assert.ok(hasEdge(analysis, "frontend/app.ts", "shared/util.ts"));
  assert.equal(analysis.summary.crossProjectRelationshipCount, 1);
});

async function makeFixture(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartographer-relationships-"));
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
    isSource: true,
    language: undefined,
    lineCount: 1,
  };
}

function hasEdge(analysis: { relationships: Array<{ sourcePath: string; targetPath?: string; status: string }> }, sourcePath: string, targetPath: string): boolean {
  return analysis.relationships.some((relationship) => relationship.status === "internal" && relationship.sourcePath === sourcePath && relationship.targetPath === targetPath);
}
