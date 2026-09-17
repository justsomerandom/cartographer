import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeRepository } from "../../src/server/analysis/repository/analyze";

test("main analyzer returns a structured read-only repository analysis", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartographer-analysis-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  await fs.writeFile(path.join(root, "src", "index.ts"), "export const answer = 42;\n// HACK fixture\n");
  await fs.writeFile(path.join(root, "README.md"), "# Fixture\n");

  const analysis = await analyzeRepository(root);

  assert.equal(analysis.errors.length, 0);
  assert.equal(analysis.info.name, path.basename(root));
  assert.equal(analysis.files.totalFiles, 3);
  assert.ok(analysis.languages.some((language) => language.language === "TypeScript"));
  assert.equal(analysis.markers.byType.HACK, 1);
  assert.equal(analysis.markers.files[0]?.path, "src/index.ts");
  assert.ok(analysis.hotspotAnalysis.hotspots.some((hotspot) => hotspot.path === "src/index.ts"));
  assert.equal(analysis.metadata.manifests[0]?.path, "package.json");
});
