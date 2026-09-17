import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";

import { validateRepositoryPath } from "../../server/analysis/repository/files";
import type { CreateSavedProjectInput, SavedProject, SavedProjectPathStatus, SavedProjectWithStatus } from "../../types/projects";
import { getProjectsDatabase } from "./database";
import { normalizeSavedProjectPath } from "./paths";

export interface ProjectsStoreOptions {
  databasePath?: string;
}

interface SavedProjectRow {
  id: string;
  path: string;
  name: string;
  created_at: string;
  last_opened_at: string | null;
}

export async function listSavedProjects(options: ProjectsStoreOptions = {}): Promise<SavedProject[]> {
  const rows = getProjectsDatabase(options.databasePath)
    .prepare(
      `
        SELECT id, path, name, created_at, last_opened_at
        FROM saved_projects
        ORDER BY
          COALESCE(last_opened_at, created_at) DESC,
          created_at DESC,
          name ASC
      `,
    )
    .all() as SavedProjectRow[];

  return rows.map(mapSavedProjectRow);
}

export async function listSavedProjectsWithStatus(options: ProjectsStoreOptions = {}): Promise<SavedProjectWithStatus[]> {
  const projects = await listSavedProjects(options);

  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      pathStatus: await getSavedProjectPathStatus(project.path),
    })),
  );
}

export async function getSavedProject(id: string, options: ProjectsStoreOptions = {}): Promise<SavedProject | null> {
  const row = getProjectsDatabase(options.databasePath)
    .prepare(
      `
        SELECT id, path, name, created_at, last_opened_at
        FROM saved_projects
        WHERE id = ?
      `,
    )
    .get(id) as SavedProjectRow | undefined;

  return row ? mapSavedProjectRow(row) : null;
}

export async function saveProject(input: string | CreateSavedProjectInput, options: ProjectsStoreOptions = {}): Promise<SavedProject> {
  const projectInput = typeof input === "string" ? { path: input } : input;
  const validation = await validateRepositoryPath(projectInput.path);

  if (!validation.ok) {
    throw new Error(validation.error.message);
  }

  const normalized = normalizeSavedProjectPath(validation.value.canonicalPath);
  const database = getProjectsDatabase(options.databasePath);
  const existingProject = database
    .prepare(
      `
        SELECT id, path, name, created_at, last_opened_at
        FROM saved_projects
        WHERE path_key = ?
      `,
    )
    .get(normalized.pathKey) as SavedProjectRow | undefined;

  if (existingProject) {
    return mapSavedProjectRow(existingProject);
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const name = projectInput.name?.trim() || normalized.name;

  database
    .prepare(
      `
        INSERT INTO saved_projects (id, path, path_key, name, created_at, last_opened_at)
        VALUES (?, ?, ?, ?, ?, NULL)
      `,
    )
    .run(id, normalized.path, normalized.pathKey, name, now);

  const savedProject = await getSavedProject(id, options);
  if (!savedProject) {
    throw new Error("Saved project could not be read after creation.");
  }

  return savedProject;
}

export async function deleteSavedProject(id: string, options: ProjectsStoreOptions = {}): Promise<void> {
  getProjectsDatabase(options.databasePath).prepare("DELETE FROM saved_projects WHERE id = ?").run(id);
}

export async function touchSavedProject(id: string, options: ProjectsStoreOptions = {}): Promise<void> {
  getProjectsDatabase(options.databasePath)
    .prepare("UPDATE saved_projects SET last_opened_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export async function getSavedProjectPathStatus(projectPath: string): Promise<SavedProjectPathStatus> {
  try {
    const stats = await fs.stat(projectPath);
    return stats.isDirectory() ? "available" : "not-directory";
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return "missing";
    }

    return "inaccessible";
  }
}

function mapSavedProjectRow(row: SavedProjectRow): SavedProject {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
  };
}
