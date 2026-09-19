import assert from "node:assert/strict";
import test from "node:test";

import { buildGraphModel, defaultGraphFilters, graphNeighbors } from "../../src/features/graphs/graph-model";
import type { SourceRelationshipAnalysis } from "../../src/types/repository";

const analysis: SourceRelationshipAnalysis = {
  modules: [
    { path: "src/a.ts", language: "typescript", projectId: "web", incomingCount: 1, outgoingCount: 2, externalImportCount: 0, unresolvedImportCount: 0 },
    { path: "src/b.ts", language: "typescript", projectId: "web", incomingCount: 1, outgoingCount: 1, externalImportCount: 0, unresolvedImportCount: 0 },
    { path: "api/c.py", language: "python", projectId: "api", incomingCount: 1, outgoingCount: 0, externalImportCount: 0, unresolvedImportCount: 0 },
  ],
  relationships: [
    { sourcePath: "src/a.ts", targetPath: "src/b.ts", importText: "./b", kind: "static-import", status: "internal", language: "typescript", sourceProjectId: "web", targetProjectId: "web", crossProject: false },
    { sourcePath: "src/b.ts", targetPath: "src/a.ts", importText: "./a", kind: "static-import", status: "internal", language: "typescript", sourceProjectId: "web", targetProjectId: "web", crossProject: false },
    { sourcePath: "src/a.ts", targetPath: "api/c.py", importText: "@api/c", kind: "static-import", status: "internal", language: "typescript", sourceProjectId: "web", targetProjectId: "api", crossProject: true },
  ], importReferences: [], unresolvedImports: [], cycles: [{ modules: ["src/a.ts", "src/b.ts"] }], errors: [],
  summary: { sourceModulesAnalyzed: 3, internalRelationshipCount: 3, externalImportCount: 0, unresolvedImportCount: 0, unsupportedDynamicImportCount: 0, isolatedModuleCount: 0, cyclicGroupCount: 1, crossProjectRelationshipCount: 1, mostDependedOn: [], highestFanOut: [] },
};

test("graph model filters language and retains only matching edges", () => {
  const model = buildGraphModel(analysis, { ...defaultGraphFilters, languages: ["typescript"] });
  assert.deepEqual(model.nodes.map((node) => node.path).sort(), ["src/a.ts", "src/b.ts"]);
  assert.equal(model.edges.length, 2);
});

test("graph model highlights cycles, cross-project edges, neighbors, and oversized graphs", () => {
  const crossProject = buildGraphModel(analysis, { ...defaultGraphFilters, crossProjectOnly: true });
  assert.equal(crossProject.edges.length, 1);
  assert.deepEqual([...graphNeighbors(buildGraphModel(analysis, defaultGraphFilters), "src/a.ts")].sort(), ["api/c.py", "src/a.ts", "src/b.ts"]);
  assert.equal(buildGraphModel(analysis, defaultGraphFilters, 2).omittedNodeCount, 1);
  assert.ok(buildGraphModel(analysis, { ...defaultGraphFilters, cyclesOnly: true }).cyclePaths.has("src/a.ts"));
});
