import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { HotspotsSection, ProjectsHome, MissingProjectView } from "../../src/components/dashboard/sections";
import { DataTable, MetricStrip, StatusBadge } from "../../src/components/dashboard/ui";

test("dashboard empty state explains saved projects", () => {
  const html = renderToStaticMarkup(<ProjectsHome savedCount={0} />);

  assert.match(html, /No saved projects/);
  assert.match(html, /Analyze a repository/);
});

test("missing project state explains unavailable saved path", () => {
  const html = renderToStaticMarkup(<MissingProjectView path="C:\\missing\\repo" />);

  assert.match(html, /Repository unavailable/);
  assert.match(html, /Missing or inaccessible/);
  assert.match(html, /missing/);
  assert.match(html, /repo/);
});

test("shared dashboard primitives render accessible tabular and status content", () => {
  const html = renderToStaticMarkup(
    <section>
      <StatusBadge tone="attention">Modified</StatusBadge>
      <MetricStrip metrics={[{ label: "Cycles", value: "2", tone: "attention" }]} />
      <DataTable headers={["Name", "Count"]} rows={[["module.ts", "3"]]} emptyText="No rows" />
    </section>,
  );

  assert.match(html, /Modified/);
  assert.match(html, /Cycles/);
  assert.match(html, /module.ts/);
});

test("hotspots section renders ranked hotspot explanations", () => {
  const html = renderToStaticMarkup(
    <HotspotsSection
      hotspotAnalysis={{
        summary: {
          filesAnalyzed: 1,
          hotspotsSurfaced: 1,
          highestChurnFile: "src/core.ts",
          mostDependedOnModule: "src/core.ts",
          filesInCycles: 1,
          recentlyActiveHotspots: 1,
        },
        hotspots: [
          {
            rank: 1,
            path: "src/core.ts",
            score: 82,
            severity: "high",
            signals: {
              churn: 1,
              recentActivity: 1,
              incomingCentrality: 1,
              outgoingCoupling: 0.5,
              size: 0.5,
              markerDensity: 0,
              cycleMembership: 1,
              contributorSpread: 0.5,
              testAwareness: 0,
            },
            metrics: {
              bytes: 500,
              markerCount: 0,
              markerDensity: 0,
              incomingCount: 3,
              outgoingCount: 1,
              inCycle: true,
              isTestFile: false,
              hasLikelyTest: true,
            },
            reasons: [{ kind: "cycle-membership", severity: "high", message: "This file is part of a detected dependency cycle." }],
          },
        ],
        categories: [{ id: "cycle-membership", label: "Cyclic", hotspots: [] }],
        weights: {
          churn: 0.22,
          recentActivity: 0.14,
          incomingCentrality: 0.18,
          outgoingCoupling: 0.12,
          size: 0.1,
          markerDensity: 0.1,
          cycleMembership: 0.08,
          contributorSpread: 0.04,
          testAwareness: 0.02,
        },
        limitations: ["Scores are repository-relative."],
      }}
    />,
  );

  assert.match(html, /Ranked hotspots/);
  assert.match(html, /src\/core.ts/);
  assert.match(html, /dependency cycle/);
});
