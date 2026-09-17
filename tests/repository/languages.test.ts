import assert from "node:assert/strict";
import test from "node:test";

import { detectLanguage } from "../../src/server/analysis/repository/languages";

test("detects languages from extensions and well-known filenames", () => {
  assert.equal(detectLanguage("src/app/page.tsx"), "TypeScript");
  assert.equal(detectLanguage("scripts/build.mjs"), "JavaScript");
  assert.equal(detectLanguage("cmd/server/main.go"), "Go");
  assert.equal(detectLanguage("Dockerfile"), "Dockerfile");
  assert.equal(detectLanguage("Makefile"), "Makefile");
  assert.equal(detectLanguage("README.md"), "Markdown");
  assert.equal(detectLanguage("assets/logo.png"), undefined);
});
