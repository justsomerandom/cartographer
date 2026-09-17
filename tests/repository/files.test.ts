import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  classifyBufferAsText,
  scanRepository,
  shouldIgnoreDirectory,
  validateRepositoryPath,
} from "../../src/server/analysis/repository/files";

test("centralized ignore rules skip dependency and build directories", () => {
  assert.equal(shouldIgnoreDirectory(".git"), true);
  assert.equal(shouldIgnoreDirectory("node_modules"), true);
  assert.equal(shouldIgnoreDirectory("dist"), true);
  assert.equal(shouldIgnoreDirectory("src"), false);
});

test("repository path validation accepts directories and rejects missing paths", async () => {
  const root = await makeTempDirectory();
  const valid = await validateRepositoryPath(root);
  assert.equal(valid.ok, true);

  const missing = await validateRepositoryPath(path.join(root, "missing"));
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.error.code, "PATH_NOT_FOUND");
  }
});

test("binary and text classification handles NUL bytes", () => {
  assert.equal(classifyBufferAsText(Buffer.from("const x = 1;\n")), true);
  assert.equal(classifyBufferAsText(Buffer.from([0x89, 0x50, 0x00, 0x47])), false);
});

test("filesystem scanning counts source files, lines, largest files, and markers", async () => {
  const root = await makeTempDirectory();
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "index.ts"), "const value = 1;\n// TODO wire UI\n// FIXME test\n");
  await fs.writeFile(path.join(root, "README.md"), "# Example\n");
  await fs.writeFile(path.join(root, "node_modules", "ignored", "skip.ts"), "// TODO ignored\n");
  await fs.writeFile(path.join(root, "image.bin"), Buffer.from([0x00, 0x01, 0x02]));

  const scan = await scanRepository(root);

  assert.equal(scan.summary.totalFiles, 3);
  assert.equal(scan.summary.sourceFiles, 2);
  assert.equal(scan.summary.binaryFiles, 1);
  assert.equal(scan.markers.byType.TODO, 1);
  assert.equal(scan.markers.byType.FIXME, 1);
  assert.ok(scan.summary.approximateLineCount >= 4);
  assert.equal(scan.summary.largestFiles.length, 3);
});

async function makeTempDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "cartographer-files-"));
}
