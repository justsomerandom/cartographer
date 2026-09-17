import assert from "node:assert/strict";
import test from "node:test";

import { emptyDependencyAnalysis } from "../../src/server/analysis/repository/dependencies/analyze";
import { analyzeHotspots } from "../../src/server/analysis/repository/hotspots/analyze";
import { rankMetricPercentiles } from "../../src/server/analysis/repository/hotspots/normalize";
import { scoreSignals } from "../../src/server/analysis/repository/hotspots/scoring";
import { emptySourceRelationshipAnalysis } from "../../src/server/analysis/repository/relationships/analyze";
import type { FileInfo, GitSummary, MarkerSummary } from "../../src/types/repository";

test("rank metric percentiles are repository-relative and ignore zero-only metrics", () => {
  const ranks = rankMetricPercentiles([
    { path: "a.ts", value: 10 },
    { path: "b.ts", value: 5 },
    { path: "c.ts", value: 0 },
  ]);

  assert.equal(ranks.get("a.ts")?.rank, 1);
  assert.equal(ranks.get("a.ts")?.percentile, 1);
  assert.equal(ranks.get("b.ts")?.percentile, 0.5);
  assert.equal(ranks.get("c.ts")?.percentile, 0);

  const zeros = rankMetricPercentiles([
    { path: "a.ts", value: 0 },
    { path: "b.ts", value: 0 },
  ]);

  assert.equal(zeros.get("a.ts")?.rank, 0);
  assert.equal(zeros.get("b.ts")?.percentile, 0);
});

test("hotspot scoring returns a 0-100 weighted score", () => {
  assert.equal(
    scoreSignals({
      churn: 1,
      recentActivity: 1,
      incomingCentrality: 1,
      outgoingCoupling: 1,
      size: 1,
      markerDensity: 1,
      cycleMembership: 1,
      contributorSpread: 1,
      testAwareness: 1,
    }),
    100,
  );
});

test("hotspot analysis ranks files and exposes explainable reasons", () => {
  const sourceRelationships = emptySourceRelationshipAnalysis();
  sourceRelationships.modules = [
    { path: "src/core.ts", language: "typescript", incomingCount: 3, outgoingCount: 2, externalImportCount: 0, unresolvedImportCount: 0 },
    { path: "src/helper.ts", language: "typescript", incomingCount: 0, outgoingCount: 0, externalImportCount: 0, unresolvedImportCount: 0 },
  ];
  sourceRelationships.cycles = [{ modules: ["src/core.ts", "src/helper.ts"] }];

  const analysis = analyzeHotspots({
    files: [file("src/core.ts", 900, 30), file("src/helper.ts", 100, 10), file("src/core.test.ts", 90, 8)],
    git: gitSummary([
      { path: "src/core.ts", touchCount: 8, recentTouchCount: 2, authors: ["Ada", "Grace"] },
      { path: "src/helper.ts", touchCount: 1, recentTouchCount: 0, authors: ["Ada"] },
    ]),
    markers: markers([{ path: "src/core.ts", count: 3 }]),
    sourceRelationships,
    dependencyAnalysis: emptyDependencyAnalysis(),
  });

  assert.equal(analysis.summary.filesAnalyzed, 3);
  assert.equal(analysis.hotspots[0]?.path, "src/core.ts");
  assert.equal(analysis.hotspots[0]?.rank, 1);
  assert.ok(analysis.hotspots[0]?.score && analysis.hotspots[0].score > 50);
  assert.ok(analysis.hotspots[0]?.reasons.some((reason) => reason.kind === "cycle-membership"));
  assert.ok(analysis.hotspots[0]?.reasons.some((reason) => reason.kind === "marker-density"));
  assert.equal(analysis.summary.filesInCycles, 2);
  assert.ok(analysis.categories.find((category) => category.id === "cycle-membership")?.hotspots.some((hotspot) => hotspot.path === "src/core.ts"));
});

test("hotspot analysis adds test-awareness signal when no likely test exists", () => {
  const analysis = analyzeHotspots({
    files: [file("src/untested.ts", 100, 10), file("src/tested.ts", 100, 10), file("src/tested.test.ts", 80, 8)],
    git: gitSummary([]),
    markers: markers([]),
    sourceRelationships: emptySourceRelationshipAnalysis(),
    dependencyAnalysis: emptyDependencyAnalysis(),
  });

  const untested = analysis.hotspots.find((hotspot) => hotspot.path === "src/untested.ts");
  const tested = analysis.hotspots.find((hotspot) => hotspot.path === "src/tested.ts");

  assert.equal(untested?.metrics.hasLikelyTest, false);
  assert.equal(untested?.signals.testAwareness, 1);
  assert.equal(tested?.metrics.hasLikelyTest, true);
  assert.equal(tested?.signals.testAwareness, 0);
});

function file(filePath: string, bytes: number, lineCount: number): FileInfo {
  return {
    path: filePath,
    bytes,
    isBinary: false,
    isText: true,
    isSource: true,
    language: "TypeScript",
    lineCount,
  };
}

function gitSummary(fileHistory: GitSummary["fileHistory"]): GitSummary {
  return {
    availability: "available",
    isRepository: true,
    detachedHead: false,
    dirty: false,
    contributors: [],
    recentCommits: [],
    hotFiles: [],
    fileHistory,
    errors: [],
  };
}

function markers(files: MarkerSummary["files"]): MarkerSummary {
  return {
    total: files.reduce((total, entry) => total + entry.count, 0),
    byType: {
      TODO: 0,
      FIXME: 0,
      HACK: 0,
      XXX: 0,
    },
    files,
    topFiles: files.slice(0, 10),
  };
}
