import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databaseConnections = new Map<string, Database.Database>();

export function defaultProjectsDatabasePath(): string {
  return path.join(process.cwd(), "data", "cartographer.db");
}

export function getProjectsDatabase(databasePath = defaultProjectsDatabasePath()): Database.Database {
  const resolvedPath = path.resolve(databasePath);
  const existingConnection = databaseConnections.get(resolvedPath);

  if (existingConnection) {
    return existingConnection;
  }

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const database = new Database(resolvedPath);
  database.pragma("journal_mode = WAL");
  initializeProjectsDatabase(database);
  databaseConnections.set(resolvedPath, database);

  return database;
}

export function closeProjectsDatabase(databasePath?: string): void {
  if (databasePath) {
    const resolvedPath = path.resolve(databasePath);
    const database = databaseConnections.get(resolvedPath);
    if (database) {
      database.close();
      databaseConnections.delete(resolvedPath);
    }
    return;
  }

  for (const database of databaseConnections.values()) {
    database.close();
  }
  databaseConnections.clear();
}

function initializeProjectsDatabase(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS saved_projects (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      path_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_opened_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_saved_projects_last_opened
      ON saved_projects(last_opened_at, created_at);
  `);
}
