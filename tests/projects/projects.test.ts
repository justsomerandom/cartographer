import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { closeProjectsDatabase, getProjectsDatabase } from "../../src/lib/projects/database";
import { normalizeSavedProjectPath } from "../../src/lib/projects/paths";
import {
  deleteSavedProject,
  listSavedProjects,
  listSavedProjectsWithStatus,
  saveProject,
  touchSavedProject,
} from "../../src/lib/projects/projects";

test("initializes the saved projects database schema", async (t) => {
  const fixture = await makeProjectsFixture(t);
  const database = getProjectsDatabase(fixture.databasePath);
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'saved_projects'")
    .get() as { name: string } | undefined;

  assert.equal(row?.name, "saved_projects");
});

test("saves, lists, deduplicates, touches, and deletes projects", async (t) => {
  const fixture = await makeProjectsFixture(t);
  await fs.mkdir(fixture.repositoryPath, { recursive: true });

  const firstSave = await saveProject(path.join(fixture.repositoryPath, "."), { databasePath: fixture.databasePath });
  const duplicateSave = await saveProject(fixture.repositoryPath, { databasePath: fixture.databasePath });

  assert.equal(duplicateSave.id, firstSave.id);
  assert.equal((await listSavedProjects({ databasePath: fixture.databasePath })).length, 1);

  await touchSavedProject(firstSave.id, { databasePath: fixture.databasePath });
  const touched = await listSavedProjects({ databasePath: fixture.databasePath });

  assert.equal(touched[0]?.id, firstSave.id);
  assert.ok(touched[0]?.lastOpenedAt);

  await deleteSavedProject(firstSave.id, { databasePath: fixture.databasePath });

  assert.equal((await listSavedProjects({ databasePath: fixture.databasePath })).length, 0);
});

test("normalizes saved project paths consistently", () => {
  const normalized = normalizeSavedProjectPath(path.join(os.tmpdir(), "cartographer", "..", "cartographer-project"));

  assert.equal(normalized.path, path.normalize(normalized.path));
  assert.equal(normalized.name, "cartographer-project");
  assert.equal(normalized.pathKey, process.platform === "win32" ? normalized.path.toLowerCase() : normalized.path);
});

test("reports missing saved repositories without deleting them", async (t) => {
  const fixture = await makeProjectsFixture(t);
  await fs.mkdir(fixture.repositoryPath, { recursive: true });

  const project = await saveProject(fixture.repositoryPath, { databasePath: fixture.databasePath });
  await fs.rm(fixture.repositoryPath, { recursive: true, force: true });

  const projects = await listSavedProjectsWithStatus({ databasePath: fixture.databasePath });

  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.id, project.id);
  assert.equal(projects[0]?.pathStatus, "missing");
});

async function makeProjectsFixture(t: TestContext): Promise<{ root: string; repositoryPath: string; databasePath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartographer-projects-"));
  const fixture = {
    root,
    repositoryPath: path.join(root, "repo"),
    databasePath: path.join(root, "db", "cartographer.db"),
  };

  t.after(async () => {
    closeProjectsDatabase(fixture.databasePath);
    await fs.rm(root, { recursive: true, force: true });
  });

  return fixture;
}
