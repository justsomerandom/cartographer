import assert from "node:assert/strict";
import test from "node:test";

import { detectProjectMetadata } from "../../src/server/analysis/repository/metadata";
import type { FileInfo } from "../../src/types/repository";

test("detects structured project metadata indicators", () => {
  const files: FileInfo[] = [
    file("README.md"),
    file("package.json"),
    file("Dockerfile"),
    file(".github/workflows/ci.yml"),
    file("src/app.test.ts"),
    file(".env.example"),
    file("LICENSE"),
  ];

  const metadata = detectProjectMetadata(files, [".github", ".github/workflows", "tests"]);

  assert.equal(metadata.readmes.length, 1);
  assert.equal(metadata.manifests[0]?.label, "npm package");
  assert.equal(metadata.containers[0]?.label, "Dockerfile");
  assert.equal(metadata.ci[0]?.label, "GitHub Actions workflow");
  assert.ok(metadata.tests.some((item) => item.label === "Test file"));
  assert.ok(metadata.tests.some((item) => item.label === "Test directory"));
  assert.equal(metadata.environmentExamples.length, 1);
  assert.equal(metadata.licenses.length, 1);
});

function file(filePath: string): FileInfo {
  return {
    path: filePath,
    bytes: 10,
    isBinary: false,
    isText: true,
    isSource: true,
    language: "TypeScript",
    lineCount: 1,
  };
}
