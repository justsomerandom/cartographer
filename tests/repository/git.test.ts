import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { analyzeGit } from "../../src/server/analysis/repository/git";

const execFileAsync = promisify(execFile);

test("git analysis reads deterministic local repository history", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartographer-git-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await git(root, ["init"]);
  await git(root, ["config", "user.name", "Cartographer Test"]);
  await git(root, ["config", "user.email", "cartographer@example.invalid"]);

  await fs.writeFile(path.join(root, "README.md"), "# Test\n");
  await git(root, ["add", "README.md"]);
  await git(root, ["commit", "-m", "Initial commit"]);

  await fs.writeFile(path.join(root, "README.md"), "# Test\n\nTODO later\n");
  await fs.writeFile(path.join(root, "index.ts"), "export const value = 1;\n");
  await git(root, ["add", "README.md", "index.ts"]);
  await git(root, ["commit", "-m", "Add TypeScript file"]);

  const summary = await analyzeGit(root);

  assert.equal(summary.availability, "available");
  assert.equal(summary.isRepository, true);
  assert.equal(summary.dirty, false);
  assert.equal(summary.totalCommits, 2);
  assert.equal(summary.latestCommitMessage, "Add TypeScript file");
  assert.ok(summary.headCommit);
  assert.ok(summary.contributors.some((contributor) => contributor.name === "Cartographer Test" && contributor.commitCount === 2));
  assert.equal(summary.recentCommits.length, 2);
  assert.ok(summary.hotFiles.some((file) => file.path === "README.md" && file.changeCount === 2));
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd, windowsHide: true });
}
