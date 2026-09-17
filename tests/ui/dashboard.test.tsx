import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectsHome, MissingProjectView } from "../../src/components/dashboard/sections";
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
